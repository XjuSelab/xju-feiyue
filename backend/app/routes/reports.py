"""Governance routes — user reports + admin moderation resolutions."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Comment, Note, Report, User
from app.deps import get_current_user, get_db, require_admin
from app.schemas.note import NoteAuthorOut
from app.schemas.report import ReportCreateIn, ReportOut, ReportResolveIn
from app.services.moderation import review_report
from app.settings import settings

router = APIRouter(tags=["governance"])

_SNAPSHOT_MAX = 500
_OPEN_STATUSES = ["pending", "ai_flagged"]


def _author_out(user: User | None) -> NoteAuthorOut | None:
    if user is None:
        return None
    return NoteAuthorOut(
        sid=user.sid,
        nickname=user.nickname,
        avatar=user.avatar,
        avatar_thumb=user.avatar_thumb,
    )


def _report_out(report: Report, reporter: User | None = None) -> ReportOut:
    return ReportOut(
        id=report.id,
        target_type=report.target_type,
        target_note_id=report.target_note_id,
        target_comment_id=report.target_comment_id,
        target_snapshot=report.target_snapshot,
        reason=report.reason,
        description=report.description,
        status=report.status,
        ai_label=report.ai_label,
        ai_confidence=report.ai_confidence,
        ai_reason=report.ai_reason,
        resolution_action=report.resolution_action,
        resolution_comment=report.resolution_comment,
        resolved_by_sid=report.resolved_by_sid,
        resolved_at=report.resolved_at,
        created_at=report.created_at,
        updated_at=report.updated_at,
        reporter=_author_out(reporter),
    )


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreateIn,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    note_id: str | None = None
    comment_id: str | None = None
    if body.target_type == "note":
        note = await db.get(Note, body.target_id)
        if not note or note.status != "visible":
            raise HTTPException(status_code=404, detail="举报对象不存在")
        note_id = note.id
        snapshot = f"{note.title}\n{note.summary}"[:_SNAPSHOT_MAX]
    else:
        comment = await db.get(Comment, body.target_id)
        if not comment or comment.status != "visible":
            raise HTTPException(status_code=404, detail="举报对象不存在")
        comment_id = comment.id
        snapshot = comment.content[:_SNAPSHOT_MAX]

    # De-dupe: keep at most one open report per (reporter, target).
    dup_stmt = select(Report).where(
        Report.reporter_sid == user.sid,
        Report.status.in_(_OPEN_STATUSES),
    )
    dup_stmt = dup_stmt.where(
        Report.target_note_id == note_id
        if note_id
        else Report.target_comment_id == comment_id
    )
    existing = (await db.execute(dup_stmt)).scalars().first()
    if existing is not None:
        return _report_out(existing, user)

    report = Report(
        id=str(uuid4()),
        reporter_sid=user.sid,
        target_type=body.target_type,
        target_note_id=note_id,
        target_comment_id=comment_id,
        target_snapshot=snapshot,
        reason=body.reason,
        description=body.description,
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    # Fire-and-forget AI pre-screen; the report is already returned as pending.
    if settings.moderation_enabled:
        background.add_task(review_report, report.id)
    return _report_out(report, user)


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ReportOut]:
    stmt = select(Report).order_by(Report.created_at.desc())
    if status_filter:
        stmt = stmt.where(Report.status == status_filter)
    reports = list((await db.execute(stmt)).scalars().all())

    sids = {r.reporter_sid for r in reports}
    reporters: dict[str, User] = {}
    if sids:
        rows = (await db.execute(select(User).where(User.sid.in_(sids)))).scalars().all()
        reporters = {u.sid: u for u in rows}
    return [_report_out(r, reporters.get(r.reporter_sid)) for r in reports]


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: str,
    body: ReportResolveIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="举报不存在")

    if body.action in ("hide", "delete"):
        target: Note | Comment | None = None
        if report.target_note_id:
            target = await db.get(Note, report.target_note_id)
        elif report.target_comment_id:
            target = await db.get(Comment, report.target_comment_id)
        if target is not None:
            if body.action == "hide":
                target.status = "hidden"
            else:
                # Detach the report from the target BEFORE deleting it, so the
                # ON DELETE CASCADE doesn't wipe this audit record. The snapshot
                # keeps a record of what was removed.
                report.target_note_id = None
                report.target_comment_id = None
                await db.flush()
                await db.delete(target)

    report.status = "dismissed" if body.action == "dismiss" else "resolved"
    report.resolution_action = body.action
    report.resolution_comment = body.comment
    report.resolved_by_sid = admin.sid
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return _report_out(report)
