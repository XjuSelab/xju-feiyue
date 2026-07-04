"""HTTP routes for /groups/* — 小组 lifecycle, 申请加入, 组内空间.

Wire format is camelCase (app/schemas/group.py). Group listing/creation
lives under /classes/me/groups (scoped to the caller's class like the other
/classes/me/* routes); per-group endpoints address /groups/{gid} directly
and re-derive the class scope from the group row.

Permission ladder (services/groups.py): class member → sees cards/detail;
group member (or 班委-of-class / admin) → inner space (files/tasks); group
manager (组长 / 班委 / admin) → meta writes, approvals, member removal.
"""

from __future__ import annotations

import secrets
import time
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from PIL import UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import GroupFile, GroupJoinRequest, GroupTask, User
from app.deps import get_current_user, get_db
from app.schemas.classes import ClassMemberOut
from app.schemas.group import (
    GroupCreateIn,
    GroupDetailOut,
    GroupFileOut,
    GroupOut,
    GroupTaskOut,
    GroupUpdateIn,
    JoinRequestCreateIn,
    JoinRequestOut,
    TaskCreateIn,
    TaskUpdateIn,
    TransferLeaderIn,
)
from app.services import classes as classes_svc
from app.services import groups as svc
from app.services.auth import is_admin
from app.services.materials import clean_name
from app.services.uploads_common import make_thumbnail, save_upload
from app.settings import settings

router = APIRouter(tags=["groups"])

# Group logos follow the avatar constraints (routes/auth.py), not the 50 MB
# document pipeline: small raster image, PIL-validated, 160px thumbnail.
ALLOWED_LOGO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2 MB
LOGO_THUMB_PX = 160


# ---------------------------------------------------------------------------
# Group lifecycle
# ---------------------------------------------------------------------------


@router.get("/classes/me/groups", response_model=list[GroupOut])
async def list_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupOut]:
    """All live groups of the caller's class, with viewer-relative fields."""
    class_id = classes_svc.ensure_in_class(user)
    return await svc.groups_out(db, class_id, user)


@router.get("/classes/me/groups/unassigned", response_model=list[ClassMemberOut])
async def list_unassigned_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClassMemberOut]:
    """未进组名单 — class members not in any live group (小组 tab 底部)."""
    class_id = classes_svc.ensure_in_class(user)
    return await svc.unassigned_members_out(db, class_id)


@router.post("/classes/me/groups", response_model=GroupOut, status_code=201)
async def create_group(
    body: GroupCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupOut:
    """Create a group — the creator becomes 组长 (one live group per person)."""
    class_id = classes_svc.ensure_in_class(user)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="小组名称不能为空")
    group = await svc.create_group(db, class_id, user, name, (body.intro or "").strip())
    outs = await svc.groups_out(db, class_id, user)
    return next(o for o in outs if o.id == group.id)


@router.get("/groups/{gid}", response_model=GroupDetailOut)
async def get_group(
    gid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupDetailOut:
    """Group space header — members + intro (visible to the whole class)."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    return await svc.group_detail_out(db, group, user)


@router.patch("/groups/{gid}", response_model=GroupDetailOut)
async def update_group(
    gid: str,
    body: GroupUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupDetailOut:
    """Edit name/intro (组长/班委/admin)."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)

    payload = body.model_dump(exclude_unset=True)
    if "name" in payload:
        name = (payload["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="小组名称不能为空")
        await svc.assert_group_name_free(db, group.class_id, name, exclude_gid=group.id)
        group.name = name
    if "intro" in payload:
        group.intro = (payload["intro"] or "").strip()
    await db.commit()
    await db.refresh(group)
    return await svc.group_detail_out(db, group, user)


@router.post("/groups/{gid}/logo", response_model=GroupDetailOut)
async def upload_logo(
    gid: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupDetailOut:
    """Set the group logo (组长/班委/admin) — the avatar pipeline, per group."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)

    ext = ALLOWED_LOGO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="仅支持 png / jpg / webp / gif")
    data = await file.read()
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="小组 Logo 不能超过 2 MB")
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")

    dest_dir = svc.GROUPS_DIR / gid
    dest_dir.mkdir(parents=True, exist_ok=True)
    # `logo-<ts>-<rand>.ext` — cache-busting + collision-safe.
    stem = f"logo-{int(time.time())}-{secrets.token_hex(4)}"
    fname = f"{stem}{ext}"
    thumb_name = f"{stem}.thumb.jpg"
    out_path = dest_dir / fname
    thumb_path = dest_dir / thumb_name
    out_path.write_bytes(data)
    try:
        make_thumbnail(data, thumb_path, LOGO_THUMB_PX)
    except UnidentifiedImageError as e:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="无法解析图片") from e

    base = settings.public_base_url
    group.logo = f"{base}/uploads/groups/{gid}/{fname}"
    group.logo_thumb = f"{base}/uploads/groups/{gid}/{thumb_name}"
    await db.commit()
    await db.refresh(group)
    return await svc.group_detail_out(db, group, user)


@router.delete("/groups/{gid}", status_code=204)
async def delete_group(
    gid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """解散小组 (组长/班委/admin) — soft-delete + unlink files; members freed."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)
    await svc.soft_delete_group(db, group)
    await db.commit()


# ---------------------------------------------------------------------------
# Join requests (申请加入)
# ---------------------------------------------------------------------------


@router.post("/groups/{gid}/join-requests", response_model=JoinRequestOut, status_code=201)
async def create_join_request(
    gid: str,
    body: JoinRequestCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JoinRequestOut:
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    req = await svc.create_join_request(db, group, user, body.message)
    return await svc.request_to_out(db, req)


@router.get("/groups/{gid}/join-requests", response_model=list[JoinRequestOut])
async def list_join_requests(
    gid: str,
    status: str | None = Query(default=None, pattern="^(pending|approved|rejected)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[JoinRequestOut]:
    """The group's request queue (组长/班委/admin)."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)
    conds = [GroupJoinRequest.group_id == gid]
    if status is not None:
        conds.append(GroupJoinRequest.status == status)
    stmt = (
        select(GroupJoinRequest).where(*conds).order_by(GroupJoinRequest.created_at.desc())
    )
    reqs = (await db.execute(stmt)).scalars().all()
    return [await svc.request_to_out(db, r) for r in reqs]


@router.post("/groups/{gid}/join-requests/{req_id}/approve", response_model=JoinRequestOut)
async def approve_join_request(
    gid: str,
    req_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JoinRequestOut:
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)
    req = await svc.get_request_or_404(db, group, req_id)
    req = await svc.approve_request(db, group, req, user)
    return await svc.request_to_out(db, req)


@router.post("/groups/{gid}/join-requests/{req_id}/reject", response_model=JoinRequestOut)
async def reject_join_request(
    gid: str,
    req_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JoinRequestOut:
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)
    req = await svc.get_request_or_404(db, group, req_id)
    req = await svc.reject_request(db, req, user)
    return await svc.request_to_out(db, req)


@router.delete("/groups/{gid}/join-requests/{req_id}", status_code=204)
async def cancel_join_request(
    gid: str,
    req_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """撤回申请 — the applicant cancels their own *pending* request."""
    group = await svc.get_group_or_404(db, gid)
    req = await svc.get_request_or_404(db, group, req_id)
    if req.sid != user.sid and not is_admin(user):
        raise HTTPException(status_code=403, detail="只能撤回自己的申请")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="该申请已被处理")
    await db.delete(req)
    await db.commit()


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------


@router.delete("/groups/{gid}/members/{sid}", status_code=204)
async def remove_member(
    gid: str,
    sid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """退出小组 (self) or 移除成员 (组长/班委/admin).

    The 组长 can't leave or be removed — transfer leadership (or 解散) first,
    so a group never ends up leaderless.
    """
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    if sid != user.sid:
        svc.ensure_group_manager(group, user)
    member = await svc.membership_of(db, gid, sid)
    if member is None:
        raise HTTPException(status_code=404, detail="该同学不在小组中")
    if sid == group.leader_sid:
        raise HTTPException(status_code=400, detail="组长请先转让组长或解散小组")
    await db.delete(member)
    await db.commit()


@router.post("/groups/{gid}/transfer-leader", response_model=GroupDetailOut)
async def transfer_leader(
    gid: str,
    body: TransferLeaderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupDetailOut:
    """转让组长 (组长/班委/admin) — target must already be a member."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    svc.ensure_group_manager(group, user)

    target = await svc.membership_of(db, gid, body.sid)
    if target is None:
        raise HTTPException(status_code=404, detail="该同学不在小组中")
    if body.sid == group.leader_sid:
        raise HTTPException(status_code=400, detail="该同学已是组长")

    old_leader = await svc.membership_of(db, gid, group.leader_sid)
    if old_leader is not None:
        old_leader.role = "member"
    target.role = "leader"
    group.leader_sid = body.sid
    await db.commit()
    await db.refresh(group)
    return await svc.group_detail_out(db, group, user)


# ---------------------------------------------------------------------------
# Files (组内文件 — flat list, materials upload pipeline)
# ---------------------------------------------------------------------------


@router.get("/groups/{gid}/files", response_model=list[GroupFileOut])
async def list_files(
    gid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupFileOut]:
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    return await svc.list_group_files(db, gid)


@router.post("/groups/{gid}/files", response_model=list[GroupFileOut])
async def upload_files(
    gid: str,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupFileOut]:
    """Upload files into the group space (any group member).

    Streams through the shared `save_upload` (50 MB cap, allowlist, magic
    sniff). Returns the full refreshed list so the client re-renders in one
    round-trip (materials pattern).
    """
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)

    dest_dir = svc.GROUPS_DIR / gid
    for upload in files:
        saved = await save_upload(upload, dest_dir)
        db.add(
            GroupFile(
                id=uuid4().hex,
                group_id=gid,
                name=clean_name(upload.filename),
                ext=saved.ext.lstrip("."),
                mime=saved.mime,
                size_bytes=saved.size,
                url=svc.public_url(gid, saved.fname),
                storage_path=svc.storage_rel_path(gid, saved.fname),
                uploaded_by_sid=user.sid,
            )
        )
    await db.commit()
    return await svc.list_group_files(db, gid)


@router.get("/groups/{gid}/files/{file_id}/download")
async def download_file(
    gid: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Stream a group file with UTF-8 `Content-Disposition: attachment`."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    file = await svc.get_file_or_404(db, gid, file_id)
    if not file.storage_path:
        raise HTTPException(status_code=404, detail="文件已不存在")
    path = svc.UPLOAD_ROOT / file.storage_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="文件已不存在")

    ascii_fallback = file.name.encode("ascii", "ignore").decode("ascii") or "file"
    disposition = (
        f"attachment; filename=\"{ascii_fallback}\"; "
        f"filename*=UTF-8''{quote(file.name)}"
    )
    return FileResponse(
        path,
        media_type=file.mime or "application/octet-stream",
        headers={
            "Content-Disposition": disposition,
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/groups/{gid}/files/{file_id}", status_code=204)
async def delete_file(
    gid: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a file (uploader or 组长/班委/admin) + unlink the blob."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    file = await svc.get_file_or_404(db, gid, file_id)
    if file.uploaded_by_sid != user.sid:
        svc.ensure_group_manager(group, user)
    file.deleted = True
    svc._unlink_storage(file)
    await db.commit()


# ---------------------------------------------------------------------------
# Tasks (甘特图任务)
# ---------------------------------------------------------------------------


@router.get("/groups/{gid}/tasks", response_model=list[GroupTaskOut])
async def list_tasks(
    gid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupTaskOut]:
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    return await svc.tasks_out(db, gid)


@router.post("/groups/{gid}/tasks", response_model=GroupTaskOut, status_code=201)
async def create_task(
    gid: str,
    body: TaskCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupTaskOut:
    """Create a Gantt task (any group member). Assignees must be members."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)

    assignees = await svc.validate_assignees(db, group, body.assignee_sids)
    task = GroupTask(
        id=uuid4().hex,
        group_id=gid,
        title=body.title.strip(),
        description=(body.description or "").strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        progress=body.progress,
        created_by_sid=user.sid,
    )
    db.add(task)
    await db.flush()
    await svc.set_task_assignees(db, task.id, assignees)
    await db.commit()
    await db.refresh(task)
    return await svc.task_out_single(db, task)


@router.patch("/groups/{gid}/tasks/{task_id}", response_model=GroupTaskOut)
async def update_task(
    gid: str,
    task_id: str,
    body: TaskUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupTaskOut:
    """Partial update (any group member); assigneeSids replaces the set.

    Date ordering is re-validated against the *merged* (existing + patched)
    range — a drag-move PATCHes both dates, an edit dialog may send one.
    """
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    task = await svc.get_task_or_404(db, gid, task_id)

    payload = body.model_dump(exclude_unset=True)
    new_start = payload.get("start_date", task.start_date)
    new_end = payload.get("end_date", task.end_date)
    svc.validate_task_dates(new_start, new_end)

    if "title" in payload:
        title = (payload["title"] or "").strip()
        if not title:
            raise HTTPException(status_code=422, detail="任务标题不能为空")
        task.title = title
    if "description" in payload:
        task.description = (payload["description"] or "").strip()
    task.start_date = new_start
    task.end_date = new_end
    if "status" in payload:
        task.status = payload["status"]
    if "progress" in payload:
        task.progress = payload["progress"]
    if "assignee_sids" in payload and payload["assignee_sids"] is not None:
        assignees = await svc.validate_assignees(db, group, payload["assignee_sids"])
        await svc.set_task_assignees(db, task.id, assignees)

    await db.commit()
    await db.refresh(task)
    return await svc.task_out_single(db, task)


@router.delete("/groups/{gid}/tasks/{task_id}", status_code=204)
async def delete_task(
    gid: str,
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task (creator or 组长/班委/admin) — assignees go via CASCADE."""
    group = await svc.get_group_or_404(db, gid)
    svc.ensure_class_member(group, user)
    await svc.ensure_group_member(db, group, user)
    task = await svc.get_task_or_404(db, gid, task_id)
    if task.created_by_sid != user.sid:
        svc.ensure_group_manager(group, user)
    await db.delete(task)
    await db.commit()
