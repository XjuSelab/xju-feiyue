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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.deps import get_current_user, get_db
from app.schemas.classes import (
    ClassMemberOut,
    ClassMeOut,
    RollCallCreateIn,
    RollCallDetailOut,
    RollCallRecordIn,
    RollCallRecordOut,
    RollCallSummaryOut,
    RollCallUpdateIn,
)
from app.services import classes as svc

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
