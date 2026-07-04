"""Business layer for /groups/* — 小组, 申请加入, 组内文件 + 甘特任务.

Permission ladder (each level includes the ones below it, admins override
everywhere):

- *class member of the group's class*: sees the group card / detail;
- *group member*: sees + writes the inner space (files / tasks / intro read);
- *group manager* (组长 or 班委-of-that-class): edits meta, approves joins,
  removes members, deletes.

House rules copied from materials: soft-delete (``deleted`` flag) + physical
unlink at delete time, flat SELECT + Python grouping (no ``lazy="raise"``
traversal), name uniqueness among *live* rows enforced here (not a DB
constraint — soft-deleted rows must not block name reuse).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Group,
    GroupFile,
    GroupJoinRequest,
    GroupMember,
    GroupTask,
    GroupTaskAssignee,
    User,
)
from app.schemas.group import (
    GroupDetailOut,
    GroupFileOut,
    GroupMemberOut,
    GroupOut,
    GroupTaskOut,
    JoinRequestOut,
    TaskAssigneeOut,
)
from app.services.auth import is_admin
from app.services.classes import is_committee_of
from app.services.materials import human_size
from app.settings import settings

# Disk layout: <repo>/backend/uploads/groups/<gid>/<ts>-<rand>.<ext>.
# Mirrors services/materials.py::UPLOAD_ROOT so the StaticFiles mount + HF
# `uploads dir_tar` artifact cover it with zero config change.
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
GROUPS_DIR = UPLOAD_ROOT / "groups"


# ---------------------------------------------------------------------------
# Loaders + permission helpers
# ---------------------------------------------------------------------------


async def get_group_or_404(db: AsyncSession, gid: str) -> Group:
    """Fetch a non-deleted group by id or raise 404."""
    group = await db.get(Group, gid)
    if not group or group.deleted:
        raise HTTPException(status_code=404, detail="小组不存在")
    return group


def ensure_class_member(group: Group, user: User) -> None:
    """Card/detail visibility: same class only (404 keeps it undiscoverable)."""
    if user.class_id != group.class_id and not is_admin(user):
        raise HTTPException(status_code=404, detail="小组不存在")


async def membership_of(db: AsyncSession, gid: str, sid: str) -> GroupMember | None:
    return await db.get(GroupMember, (gid, sid))


async def ensure_group_member(db: AsyncSession, group: Group, user: User) -> None:
    """Inner-space access: member OR 班委-of-that-class OR admin."""
    if is_admin(user) or is_committee_of(user, group.class_id):
        return
    if await membership_of(db, group.id, user.sid) is None:
        raise HTTPException(status_code=403, detail="仅小组成员可访问")


def ensure_group_manager(group: Group, user: User) -> None:
    """Meta writes / approvals: 组长 OR 班委-of-that-class OR admin."""
    if group.leader_sid == user.sid or is_committee_of(user, group.class_id) or is_admin(user):
        return
    raise HTTPException(status_code=403, detail="仅组长或班委可执行此操作")


async def user_group_in_class(db: AsyncSession, class_id: int, sid: str) -> Group | None:
    """The user's live group in this class, if any (the one-group rule)."""
    stmt = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(
            GroupMember.sid == sid,
            Group.class_id == class_id,
            Group.deleted == False,  # noqa: E712
        )
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def assert_group_name_free(
    db: AsyncSession, class_id: int, name: str, *, exclude_gid: str | None = None
) -> None:
    """Raise 409 when a live group of this class already uses `name`."""
    conds = [
        Group.class_id == class_id,
        Group.deleted == False,  # noqa: E712
        Group.name == name,
    ]
    if exclude_gid is not None:
        conds.append(Group.id != exclude_gid)
    stmt = select(Group.id).where(*conds).limit(1)
    if (await db.execute(stmt)).first() is not None:
        raise HTTPException(status_code=409, detail="本班已存在同名小组")


# ---------------------------------------------------------------------------
# Group lifecycle
# ---------------------------------------------------------------------------


async def create_group(
    db: AsyncSession, class_id: int, creator: User, name: str, intro: str
) -> Group:
    """Create a group with `creator` as 组长 (also a member row)."""
    if await user_group_in_class(db, class_id, creator.sid) is not None:
        raise HTTPException(status_code=409, detail="你已加入其他小组")
    await assert_group_name_free(db, class_id, name)
    group = Group(
        id=uuid4().hex,
        class_id=class_id,
        name=name,
        intro=intro,
        leader_sid=creator.sid,
    )
    db.add(group)
    # Explicit flush before the member row — no relationship() links the two,
    # so the UOW won't guarantee the parent INSERT runs first (autoflush is
    # off in prod; see create_rollcall for the same idiom).
    await db.flush()
    db.add(GroupMember(group_id=group.id, sid=creator.sid, role="leader"))
    await db.commit()
    await db.refresh(group)
    return group


def _unlink_storage(file: GroupFile) -> None:
    """Best-effort physical delete — a failed unlink must not abort the txn."""
    if not file.storage_path:
        return
    target = UPLOAD_ROOT / file.storage_path
    try:
        target.unlink(missing_ok=True)
    except OSError:
        pass


async def soft_delete_group(db: AsyncSession, group: Group) -> None:
    """Soft-delete the group + its files, unlink blobs. Caller commits.

    Member rows are left in place (harmless — every membership query joins
    live groups only), which keeps history recoverable like materials.
    """
    group.deleted = True
    stmt = select(GroupFile).where(
        GroupFile.group_id == group.id,
        GroupFile.deleted == False,  # noqa: E712
    )
    for file in (await db.execute(stmt)).scalars().all():
        file.deleted = True
        _unlink_storage(file)


# ---------------------------------------------------------------------------
# Wire mapping (batched — no per-group query loops)
# ---------------------------------------------------------------------------


async def groups_out(db: AsyncSession, class_id: int, viewer: User) -> list[GroupOut]:
    """All live groups of a class with viewer-relative fields, in 5 queries."""
    stmt = (
        select(Group)
        .where(Group.class_id == class_id, Group.deleted == False)  # noqa: E712
        .order_by(Group.created_at)
    )
    groups = list((await db.execute(stmt)).scalars().all())
    if not groups:
        return []
    gids = [g.id for g in groups]

    counts_stmt = (
        select(GroupMember.group_id, func.count())
        .where(GroupMember.group_id.in_(gids))
        .group_by(GroupMember.group_id)
    )
    counts = dict((await db.execute(counts_stmt)).all())

    mine_stmt = select(GroupMember).where(
        GroupMember.sid == viewer.sid, GroupMember.group_id.in_(gids)
    )
    my_roles = {m.group_id: m.role for m in (await db.execute(mine_stmt)).scalars().all()}

    pending_stmt = select(GroupJoinRequest).where(
        GroupJoinRequest.sid == viewer.sid,
        GroupJoinRequest.status == "pending",
        GroupJoinRequest.group_id.in_(gids),
    )
    my_pendings = {
        r.group_id: r.id for r in (await db.execute(pending_stmt)).scalars().all()
    }

    leader_sids = {g.leader_sid for g in groups}
    nick_stmt = select(User.sid, User.nickname).where(User.sid.in_(leader_sids))
    nicknames = dict((await db.execute(nick_stmt)).all())

    return [
        GroupOut(
            id=g.id,
            name=g.name,
            logo=g.logo,
            logo_thumb=g.logo_thumb,
            intro=g.intro,
            leader_sid=g.leader_sid,
            leader_nickname=nicknames.get(g.leader_sid, ""),
            member_count=int(counts.get(g.id, 0)),
            my_role=my_roles.get(g.id),
            my_pending_request_id=my_pendings.get(g.id),
            created_at=g.created_at,
        )
        for g in groups
    ]


async def group_detail_out(db: AsyncSession, group: Group, viewer: User) -> GroupDetailOut:
    """Card fields + full member list + pending-request count."""
    members_stmt = (
        select(GroupMember, User.nickname, User.avatar_thumb)
        .join(User, User.sid == GroupMember.sid)
        .where(GroupMember.group_id == group.id)
        .order_by(GroupMember.joined_at, GroupMember.sid)
    )
    member_rows = (await db.execute(members_stmt)).all()
    members = [
        GroupMemberOut(
            sid=m.sid,
            nickname=nickname,
            avatar_thumb=avatar_thumb,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m, nickname, avatar_thumb in member_rows
    ]

    pending_stmt = (
        select(func.count())
        .select_from(GroupJoinRequest)
        .where(GroupJoinRequest.group_id == group.id, GroupJoinRequest.status == "pending")
    )
    pending_count = int((await db.execute(pending_stmt)).scalar_one())

    my_role = next((m.role for m, _, _ in member_rows if m.sid == viewer.sid), None)
    my_pending_stmt = (
        select(GroupJoinRequest.id)
        .where(
            GroupJoinRequest.group_id == group.id,
            GroupJoinRequest.sid == viewer.sid,
            GroupJoinRequest.status == "pending",
        )
        .limit(1)
    )
    my_pending = (await db.execute(my_pending_stmt)).scalar_one_or_none()

    leader_nickname = next(
        (nickname for m, nickname, _ in member_rows if m.sid == group.leader_sid), ""
    )
    return GroupDetailOut(
        id=group.id,
        name=group.name,
        logo=group.logo,
        logo_thumb=group.logo_thumb,
        intro=group.intro,
        leader_sid=group.leader_sid,
        leader_nickname=leader_nickname,
        member_count=len(members),
        my_role=my_role,
        my_pending_request_id=my_pending,
        created_at=group.created_at,
        members=members,
        pending_count=pending_count,
    )


# ---------------------------------------------------------------------------
# Join requests
# ---------------------------------------------------------------------------


async def request_to_out(db: AsyncSession, req: GroupJoinRequest) -> JoinRequestOut:
    applicant = await db.get(User, req.sid)
    return JoinRequestOut(
        id=req.id,
        group_id=req.group_id,
        sid=req.sid,
        nickname=applicant.nickname if applicant else req.sid,
        avatar_thumb=applicant.avatar_thumb if applicant else None,
        message=req.message,
        status=req.status,
        created_at=req.created_at,
        decided_by_sid=req.decided_by_sid,
        decided_at=req.decided_at,
    )


async def create_join_request(
    db: AsyncSession, group: Group, applicant: User, message: str | None
) -> GroupJoinRequest:
    """申请加入 — one pending request per (group, applicant)."""
    if await user_group_in_class(db, group.class_id, applicant.sid) is not None:
        raise HTTPException(status_code=409, detail="你已加入其他小组")
    dup_stmt = (
        select(GroupJoinRequest.id)
        .where(
            GroupJoinRequest.group_id == group.id,
            GroupJoinRequest.sid == applicant.sid,
            GroupJoinRequest.status == "pending",
        )
        .limit(1)
    )
    if (await db.execute(dup_stmt)).first() is not None:
        raise HTTPException(status_code=409, detail="你已申请过该小组，请等待审核")
    req = GroupJoinRequest(
        id=uuid4().hex,
        group_id=group.id,
        sid=applicant.sid,
        message=(message or "").strip() or None,
    )
    db.add(req)
    await db.commit()
    return req


async def get_request_or_404(
    db: AsyncSession, group: Group, req_id: str
) -> GroupJoinRequest:
    req = await db.get(GroupJoinRequest, req_id)
    if not req or req.group_id != group.id:
        raise HTTPException(status_code=404, detail="申请不存在")
    return req


async def approve_request(
    db: AsyncSession, group: Group, req: GroupJoinRequest, actor: User
) -> GroupJoinRequest:
    """Approve: add member + auto-reject the applicant's other pendings.

    Re-checks ``status == "pending"`` inside the transaction (two managers
    deciding concurrently → the second gets a 409) and re-checks the
    one-group rule (the applicant may have joined elsewhere meanwhile).
    """
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="该申请已被处理")
    applicant = await db.get(User, req.sid)
    if not applicant or applicant.class_id != group.class_id:
        raise HTTPException(status_code=409, detail="该同学已不在本班级")
    if await user_group_in_class(db, group.class_id, req.sid) is not None:
        raise HTTPException(status_code=409, detail="该同学已加入其他小组")

    now = datetime.now(timezone.utc)
    db.add(GroupMember(group_id=group.id, sid=req.sid, role="member"))
    req.status = "approved"
    req.decided_by_sid = actor.sid
    req.decided_at = now

    # Auto-reject the applicant's other pending requests in this class — they
    # can only be in one group, so leaving them dangling just confuses the
    # other leaders' queues.
    others_stmt = (
        select(GroupJoinRequest)
        .join(Group, Group.id == GroupJoinRequest.group_id)
        .where(
            GroupJoinRequest.sid == req.sid,
            GroupJoinRequest.status == "pending",
            GroupJoinRequest.id != req.id,
            Group.class_id == group.class_id,
        )
    )
    for other in (await db.execute(others_stmt)).scalars().all():
        other.status = "rejected"
        other.decided_by_sid = actor.sid
        other.decided_at = now

    await db.commit()
    return req


async def reject_request(
    db: AsyncSession, req: GroupJoinRequest, actor: User
) -> GroupJoinRequest:
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="该申请已被处理")
    req.status = "rejected"
    req.decided_by_sid = actor.sid
    req.decided_at = datetime.now(timezone.utc)
    await db.commit()
    return req


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------


def file_to_out(file: GroupFile, uploader_nickname: str) -> GroupFileOut:
    return GroupFileOut(
        id=file.id,
        name=file.name,
        ext=file.ext,
        mime=file.mime,
        size=human_size(file.size_bytes),
        size_bytes=file.size_bytes,
        url=file.url,
        uploaded_by_sid=file.uploaded_by_sid,
        uploaded_by_nickname=uploader_nickname,
        created_at=file.created_at,
    )


async def list_group_files(db: AsyncSession, gid: str) -> list[GroupFileOut]:
    stmt = (
        select(GroupFile, User.nickname)
        .join(User, User.sid == GroupFile.uploaded_by_sid)
        .where(GroupFile.group_id == gid, GroupFile.deleted == False)  # noqa: E712
        .order_by(GroupFile.created_at.desc())
    )
    return [
        file_to_out(file, nickname) for file, nickname in (await db.execute(stmt)).all()
    ]


async def get_file_or_404(db: AsyncSession, gid: str, file_id: str) -> GroupFile:
    file = await db.get(GroupFile, file_id)
    if not file or file.deleted or file.group_id != gid:
        raise HTTPException(status_code=404, detail="文件不存在")
    return file


def public_url(gid: str, fname: str) -> str:
    """Absolute public URL for a stored group file."""
    return f"{settings.public_base_url}/uploads/groups/{gid}/{fname}"


def storage_rel_path(gid: str, fname: str) -> str:
    """Relative-to-`UPLOAD_ROOT` path persisted for physical delete/locate."""
    return f"groups/{gid}/{fname}"


# ---------------------------------------------------------------------------
# Tasks (Gantt)
# ---------------------------------------------------------------------------


async def get_task_or_404(db: AsyncSession, gid: str, task_id: str) -> GroupTask:
    task = await db.get(GroupTask, task_id)
    if not task or task.group_id != gid:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


async def validate_assignees(db: AsyncSession, group: Group, sids: list[str]) -> list[str]:
    """Dedupe + require every assignee to be a current group member."""
    unique = list(dict.fromkeys(sids))
    if not unique:
        return []
    stmt = select(GroupMember.sid).where(
        GroupMember.group_id == group.id, GroupMember.sid.in_(unique)
    )
    member_sids = {row[0] for row in (await db.execute(stmt)).all()}
    missing = [sid for sid in unique if sid not in member_sids]
    if missing:
        raise HTTPException(status_code=400, detail="负责人必须是小组成员")
    return unique


def validate_task_dates(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")


async def set_task_assignees(db: AsyncSession, task_id: str, sids: list[str]) -> None:
    """Replace-all semantics — delete existing rows, insert the new set."""
    stmt = select(GroupTaskAssignee).where(GroupTaskAssignee.task_id == task_id)
    for row in (await db.execute(stmt)).scalars().all():
        await db.delete(row)
    for sid in sids:
        db.add(GroupTaskAssignee(task_id=task_id, sid=sid))


async def tasks_out(db: AsyncSession, gid: str) -> list[GroupTaskOut]:
    """All tasks of a group + batched assignee profiles, in 2 queries."""
    tasks_stmt = (
        select(GroupTask)
        .where(GroupTask.group_id == gid)
        .order_by(GroupTask.start_date, GroupTask.created_at)
    )
    tasks = list((await db.execute(tasks_stmt)).scalars().all())
    if not tasks:
        return []

    assignees_stmt = (
        select(GroupTaskAssignee.task_id, User.sid, User.nickname, User.avatar_thumb)
        .join(User, User.sid == GroupTaskAssignee.sid)
        .where(GroupTaskAssignee.task_id.in_([t.id for t in tasks]))
        .order_by(GroupTaskAssignee.sid)
    )
    by_task: dict[str, list[TaskAssigneeOut]] = {}
    for task_id, sid, nickname, avatar_thumb in (await db.execute(assignees_stmt)).all():
        by_task.setdefault(task_id, []).append(
            TaskAssigneeOut(sid=sid, nickname=nickname, avatar_thumb=avatar_thumb)
        )

    return [task_to_out(task, by_task.get(task.id, [])) for task in tasks]


def task_to_out(task: GroupTask, assignees: list[TaskAssigneeOut]) -> GroupTaskOut:
    return GroupTaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        assignee_sids=[a.sid for a in assignees],
        assignees=assignees,
        start_date=task.start_date,
        end_date=task.end_date,
        status=task.status,
        progress=task.progress,
        created_by_sid=task.created_by_sid,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def task_out_single(db: AsyncSession, task: GroupTask) -> GroupTaskOut:
    stmt = (
        select(User.sid, User.nickname, User.avatar_thumb)
        .join(GroupTaskAssignee, GroupTaskAssignee.sid == User.sid)
        .where(GroupTaskAssignee.task_id == task.id)
        .order_by(User.sid)
    )
    assignees = [
        TaskAssigneeOut(sid=sid, nickname=nickname, avatar_thumb=avatar_thumb)
        for sid, nickname, avatar_thumb in (await db.execute(stmt)).all()
    ]
    return task_to_out(task, assignees)
