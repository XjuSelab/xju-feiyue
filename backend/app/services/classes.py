"""Business layer for /classes/* — 班级 scoping + 点名 (roll-call).

Permission model (mirrors the materials `ensure_owner` ethos, but scoped to
a class instead of a resource owner):

- every read is restricted to *members of that class*;
- roll-call writes require 班委-of-that-class (``is_committee_of``);
- site admins (``services.auth.is_admin``) override everywhere.

All list responses are built from flat SELECTs + explicit column joins —
never a ``lazy="raise"`` relationship traversal.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RollCallRecord, RollCallSession, User
from app.schemas.classes import (
    ClassMemberOut,
    RollCallDetailOut,
    RollCallRecordOut,
    RollCallSummaryOut,
)
from app.services.auth import is_admin

# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------


def ensure_in_class(user: User) -> int:
    """The caller's class id, or 403 when they haven't been assigned one.

    Every /classes/me/* endpoint derives its scope from this — class ids never
    appear in user-facing URLs, so cross-class access isn't even expressible.
    """
    if user.class_id is None:
        raise HTTPException(status_code=403, detail="你还没有加入班级，请联系管理员")
    return user.class_id


def is_committee_of(user: User, class_id: int) -> bool:
    """班委 powers apply only within the user's *own* class."""
    return bool(user.is_class_committee) and user.class_id == class_id


def ensure_committee(user: User, class_id: int) -> None:
    """Authorize a committee action (roll-call writes etc.). Admins override."""
    if not (is_committee_of(user, class_id) or is_admin(user)):
        raise HTTPException(status_code=403, detail="仅班委可执行此操作")


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def list_class_members(db: AsyncSession, class_id: int) -> list[User]:
    """All users of a class, ordered by sid (a class is ≤ a few dozen rows)."""
    stmt = select(User).where(User.class_id == class_id).order_by(User.sid)
    return list((await db.execute(stmt)).scalars().all())


def member_to_out(user: User) -> ClassMemberOut:
    return ClassMemberOut(
        sid=user.sid,
        nickname=user.nickname,
        name=user.name,
        avatar_thumb=user.avatar_thumb,
        is_class_committee=user.is_class_committee,
    )


async def count_class_members(db: AsyncSession, class_id: int) -> int:
    stmt = select(func.count()).select_from(User).where(User.class_id == class_id)
    return int((await db.execute(stmt)).scalar_one())


# ---------------------------------------------------------------------------
# Roll-call
# ---------------------------------------------------------------------------


async def get_session_or_404(
    db: AsyncSession, session_id: str, class_id: int
) -> RollCallSession:
    """Fetch a roll-call session *of this class* or 404 (cross-class = unseen)."""
    sess = await db.get(RollCallSession, session_id)
    if not sess or sess.class_id != class_id:
        raise HTTPException(status_code=404, detail="点名记录不存在")
    return sess


async def create_rollcall(
    db: AsyncSession, class_id: int, actor: User, title: str | None
) -> RollCallSession:
    """Start a session and snapshot the current roster (present=False).

    The snapshot means history reflects membership *as of that day*: students
    who join the class later don't retroactively appear absent in old
    sessions. Caller-visible state comes from `rollcall_detail`.
    """
    sess = RollCallSession(
        id=uuid4().hex,
        class_id=class_id,
        title=(title or "").strip() or None,
        created_by_sid=actor.sid,
    )
    db.add(sess)
    # Explicit flush: session and records are NOT linked by a relationship(),
    # so the unit of work won't order the parent INSERT first on its own —
    # with the prod session's autoflush=False the records would hit the FK
    # before the session row exists.
    await db.flush()
    for member in await list_class_members(db, class_id):
        db.add(RollCallRecord(session_id=sess.id, sid=member.sid, present=False))
    await db.commit()
    await db.refresh(sess)
    return sess


def _counts_subquery():
    """(session_id, total, present) grouped over records — one aggregate."""
    return (
        select(
            RollCallRecord.session_id.label("session_id"),
            func.count().label("total"),
            func.sum(case((RollCallRecord.present == True, 1), else_=0)).label(  # noqa: E712
                "present"
            ),
        )
        .group_by(RollCallRecord.session_id)
        .subquery()
    )


def _summary_from_row(
    sess: RollCallSession, nickname: str, total: int | None, present: int | None
) -> RollCallSummaryOut:
    return RollCallSummaryOut(
        id=sess.id,
        title=sess.title,
        created_by_sid=sess.created_by_sid,
        created_by_nickname=nickname,
        created_at=sess.created_at,
        closed_at=sess.closed_at,
        present_count=int(present or 0),
        total_count=int(total or 0),
    )


async def rollcall_summaries(
    db: AsyncSession, class_id: int, limit: int, offset: int
) -> list[RollCallSummaryOut]:
    """History rows, newest first — 1 query (counts via grouped subquery)."""
    counts = _counts_subquery()
    stmt = (
        select(RollCallSession, User.nickname, counts.c.total, counts.c.present)
        .join(User, User.sid == RollCallSession.created_by_sid)
        .outerjoin(counts, counts.c.session_id == RollCallSession.id)
        .where(RollCallSession.class_id == class_id)
        .order_by(RollCallSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    return [_summary_from_row(sess, nickname, total, present) for sess, nickname, total, present in rows]


async def rollcall_summary(db: AsyncSession, sess: RollCallSession) -> RollCallSummaryOut:
    """Summary shape for a single (already loaded) session."""
    counts = _counts_subquery()
    stmt = (
        select(User.nickname, counts.c.total, counts.c.present)
        .select_from(RollCallSession)
        .join(User, User.sid == RollCallSession.created_by_sid)
        .outerjoin(counts, counts.c.session_id == RollCallSession.id)
        .where(RollCallSession.id == sess.id)
    )
    nickname, total, present = (await db.execute(stmt)).one()
    return _summary_from_row(sess, nickname, total, present)


async def rollcall_detail(db: AsyncSession, sess: RollCallSession) -> RollCallDetailOut:
    """Summary + the full per-member roster (records joined with users)."""
    summary = await rollcall_summary(db, sess)
    stmt = (
        select(RollCallRecord, User.nickname, User.avatar_thumb)
        .join(User, User.sid == RollCallRecord.sid)
        .where(RollCallRecord.session_id == sess.id)
        .order_by(RollCallRecord.sid)
    )
    records = [
        RollCallRecordOut(
            sid=rec.sid,
            nickname=nickname,
            avatar_thumb=avatar_thumb,
            present=rec.present,
            checked_at=rec.checked_at,
        )
        for rec, nickname, avatar_thumb in (await db.execute(stmt)).all()
    ]
    return RollCallDetailOut(**summary.model_dump(by_alias=False), records=records)


async def upsert_record(
    db: AsyncSession,
    sess: RollCallSession,
    target_sid: str,
    present: bool,
    actor: User,
) -> RollCallRecord:
    """One checkbox click — a single-row upsert (never a bulk sheet save).

    Upsert (not update-only) so a member who joined the class *after* the
    session snapshot can still be checked in. The target must currently be a
    member of the session's class.
    """
    target = await db.get(User, target_sid)
    if not target or target.class_id != sess.class_id:
        raise HTTPException(status_code=404, detail="该同学不在本班级")

    rec = await db.get(RollCallRecord, (sess.id, target_sid))
    now = datetime.now(timezone.utc)
    if rec is None:
        rec = RollCallRecord(
            session_id=sess.id,
            sid=target_sid,
            present=present,
            checked_at=now,
            checked_by_sid=actor.sid,
        )
        db.add(rec)
    else:
        rec.present = present
        rec.checked_at = now
        rec.checked_by_sid = actor.sid
    await db.commit()
    return rec
