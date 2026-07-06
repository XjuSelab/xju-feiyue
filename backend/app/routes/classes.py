"""HTTP routes for /classes/me/* — 班级空间 (class info, members, 点名).

Wire format is camelCase (app/schemas/classes.py). Every endpoint here is
scoped to *the caller's own class* — the class id comes from the JWT user's
``class_id``, never from the URL, so cross-class access isn't expressible.
Reads require class membership; roll-call writes require 班委-of-that-class
(site admins override, `services.classes.ensure_committee`).

The top-level prefix `/classes` matches the `/materials` style: no router
``prefix=``, each path carries its own segment; main.py wires the router.
"""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import StudentClass, User
from app.deps import get_current_user, get_db
from app.services.class_export import build_class_groups_docx
from app.schemas.classes import (
    ClassMemberOut,
    ClassMeOut,
    MemberCommitteeIn,
    MissionCreateIn,
    MissionOut,
    MissionUpdateIn,
    RollCallCreateIn,
    RollCallDetailOut,
    RollCallRecordIn,
    RollCallRecordOut,
    RollCallSummaryOut,
    RollCallUpdateIn,
)
from app.services import classes as svc
from app.services.auth import is_superadmin

router = APIRouter(tags=["classes"])


@router.get("/classes/me", response_model=ClassMeOut)
async def get_my_class(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassMeOut:
    """The caller's class card — 200 with null fields when unassigned.

    Deliberately not a 404: the frontend renders a "联系管理员" empty state
    for classless users instead of an error path.
    """
    if user.class_id is None:
        return ClassMeOut()
    return ClassMeOut(
        class_id=user.class_id,
        class_full_name=user.class_full_name,
        class_short_name=user.class_short_name,
        is_class_committee=user.is_class_committee,
        committee_title=user.committee_title,
        member_count=await svc.count_class_members(db, user.class_id),
    )


@router.get("/classes/me/members", response_model=list[ClassMemberOut])
async def list_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClassMemberOut]:
    class_id = svc.ensure_in_class(user)
    members = await svc.list_class_members(db, class_id)
    return [svc.member_to_out(m) for m in members]


@router.post("/classes/me/members/{sid}/committee", response_model=ClassMemberOut)
async def set_member_committee(
    sid: str,
    body: MemberCommitteeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClassMemberOut:
    """班内设置班委（成员卡片右键入口）。

    权限阶梯：
    - 超级管理员：任意设置/撤销，包括授予「班长」；
    - 本班「班长」：可设/撤普通班委，但不能授予「班长」职务，也不能动
      现任班长（含自己的班长身份）—— 班长人选始终由超管定夺；
    - 其他人（含普通班委）：403。
    """
    class_id = svc.ensure_in_class(user)
    actor_is_super = is_superadmin(user)
    if not (actor_is_super or svc.is_banzhang_of(user, class_id)):
        raise HTTPException(status_code=403, detail="仅班长或超级管理员可设置班委")

    target = await db.get(User, sid)
    if not target or target.class_id != class_id:
        raise HTTPException(status_code=404, detail="该同学不在本班级")

    title = (body.committee_title or "").strip() or None
    if not actor_is_super:
        if title == svc.BANZHANG_TITLE:
            raise HTTPException(status_code=403, detail="「班长」职务须由超级管理员设置")
        if target.committee_title == svc.BANZHANG_TITLE:
            raise HTTPException(status_code=403, detail="班长身份须由超级管理员调整")

    target.is_class_committee = body.is_class_committee
    target.committee_title = title if body.is_class_committee else None
    await db.commit()
    await db.refresh(target)
    return svc.member_to_out(target)


# ---------------------------------------------------------------------------
# 分组任务 (missions) — top layer of the /class space
# ---------------------------------------------------------------------------


@router.get("/classes/me/missions", response_model=list[MissionOut])
async def list_missions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MissionOut]:
    """Every class member sees the mission list (active first)."""
    class_id = svc.ensure_in_class(user)
    return [svc.mission_to_out(m) for m in await svc.list_missions(db, class_id)]


@router.post("/classes/me/missions", response_model=MissionOut, status_code=201)
async def create_mission(
    body: MissionCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MissionOut:
    """Create a 分组任务 (班委/admin); ``active`` sets it as 进行中."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    m = await svc.create_mission(
        db, class_id, user, body.title, body.description or "", body.active
    )
    return svc.mission_to_out(m)


@router.patch("/classes/me/missions/{mission_id}", response_model=MissionOut)
async def update_mission(
    mission_id: str,
    body: MissionUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MissionOut:
    """Rename / re-describe / 设为进行中 a mission (班委/admin)."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    m = await svc.get_mission_or_404(db, mission_id, class_id)
    m = await svc.update_mission(
        db, m, title=body.title, description=body.description, active=body.active
    )
    return svc.mission_to_out(m)


@router.delete("/classes/me/missions/{mission_id}", status_code=204)
async def delete_mission(
    mission_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Hard-delete a 分组任务 (班委/admin)."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    m = await svc.get_mission_or_404(db, mission_id, class_id)
    await db.delete(m)
    await db.commit()


# ---------------------------------------------------------------------------
# 导出班级分组信息 (.docx)
# ---------------------------------------------------------------------------


DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


@router.get("/classes/me/groups/export")
async def export_class_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download the 课程设计选题一览表 .docx of every group (班委/admin)."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    clazz = user.clazz or await db.get(StudentClass, class_id)
    if clazz is None:
        raise HTTPException(status_code=404, detail="班级不存在")

    data = await build_class_groups_docx(db, clazz, class_id)
    # RFC 5987 filename* for the Chinese basename; ASCII fallback keeps old clients happy.
    stem = f"{clazz.short_name or '班级'}_工程项目开发综合实践题目汇总.docx"
    disposition = f"attachment; filename=groups.docx; filename*=UTF-8''{quote(stem)}"
    return Response(
        content=data,
        media_type=DOCX_MEDIA_TYPE,
        headers={"Content-Disposition": disposition},
    )


# ---------------------------------------------------------------------------
# Roll-call (点名)
# ---------------------------------------------------------------------------


@router.post("/classes/me/rollcalls", response_model=RollCallDetailOut, status_code=201)
async def create_rollcall(
    body: RollCallCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RollCallDetailOut:
    """Start a session (班委/admin) — snapshots the roster, all present=False."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    sess = await svc.create_rollcall(db, class_id, user, body.title)
    return await svc.rollcall_detail(db, sess)


@router.get("/classes/me/rollcalls", response_model=list[RollCallSummaryOut])
async def list_rollcalls(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RollCallSummaryOut]:
    """History (newest first) — visible to every class member."""
    class_id = svc.ensure_in_class(user)
    return await svc.rollcall_summaries(db, class_id, limit, offset)


@router.get("/classes/me/rollcalls/{session_id}", response_model=RollCallDetailOut)
async def get_rollcall(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RollCallDetailOut:
    class_id = svc.ensure_in_class(user)
    sess = await svc.get_session_or_404(db, session_id, class_id)
    return await svc.rollcall_detail(db, sess)


@router.put(
    "/classes/me/rollcalls/{session_id}/records/{sid}",
    response_model=RollCallRecordOut,
)
async def set_record(
    session_id: str,
    sid: str,
    body: RollCallRecordIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RollCallRecordOut:
    """One checkbox click — a single-row upsert (班委/admin).

    Kept deliberately tiny (never a bulk sheet save) so two 班委 checking
    concurrently can't overwrite each other's flags.
    """
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    sess = await svc.get_session_or_404(db, session_id, class_id)
    rec = await svc.upsert_record(db, sess, sid, body.present, user)
    target = await db.get(User, sid)
    return RollCallRecordOut(
        sid=rec.sid,
        nickname=target.nickname if target else rec.sid,
        avatar_thumb=target.avatar_thumb if target else None,
        present=rec.present,
        checked_at=rec.checked_at,
    )


@router.patch("/classes/me/rollcalls/{session_id}", response_model=RollCallSummaryOut)
async def update_rollcall(
    session_id: str,
    body: RollCallUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RollCallSummaryOut:
    """Rename / close (完成点名) / reopen a session (班委/admin).

    ``closed`` is informational — records stay editable after closing.
    """
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    sess = await svc.get_session_or_404(db, session_id, class_id)

    payload = body.model_dump(exclude_unset=True)
    if "title" in payload:
        sess.title = (payload["title"] or "").strip() or None
    if payload.get("closed") is True:
        sess.closed_at = datetime.now(timezone.utc)
    elif payload.get("closed") is False:
        sess.closed_at = None
    await db.commit()
    await db.refresh(sess)
    return await svc.rollcall_summary(db, sess)


@router.delete("/classes/me/rollcalls/{session_id}", status_code=204)
async def delete_rollcall(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Hard-delete a session (班委/admin) — records go with it (FK CASCADE)."""
    class_id = svc.ensure_in_class(user)
    svc.ensure_committee(user, class_id)
    sess = await svc.get_session_or_404(db, session_id, class_id)
    await db.delete(sess)
    await db.commit()
