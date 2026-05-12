"""Drafts routes — see BACKEND_SPEC.md §2 (Drafts). All routes require auth."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Draft, Note, User
from app.deps import get_current_user, get_db
from app.schemas.draft import DraftIn, DraftOut
from app.schemas.note import NoteAuthorOut, NoteOut
from app.services import ai_compose
from app.services.notes import read_minutes_from, summary_from

router = APIRouter(prefix="/notes/drafts", tags=["drafts"])


async def _get_owned_draft(
    draft_id: str, user: User, db: AsyncSession
) -> Draft:
    draft = await db.get(Draft, draft_id)
    if not draft or draft.owner_sid != user.sid:
        raise HTTPException(status_code=404, detail="草稿不存在")
    return draft


@router.post("", response_model=DraftOut, status_code=status.HTTP_201_CREATED)
async def create(
    body: DraftIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DraftOut:
    draft = Draft(
        id=str(uuid4()),
        owner_sid=user.sid,
        title=body.title or "",
        summary=body.summary or "",
        content=body.content or "",
        category=body.category,
        tags=list(body.tags or []),
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return DraftOut.model_validate(draft)


@router.get("", response_model=list[DraftOut])
async def list_mine(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DraftOut]:
    stmt = (
        select(Draft).where(Draft.owner_sid == user.sid).order_by(Draft.updated_at.desc())
    )
    drafts = (await db.execute(stmt)).scalars().all()
    return [DraftOut.model_validate(d) for d in drafts]


@router.get("/{draft_id}", response_model=DraftOut)
async def get_one(
    draft_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DraftOut:
    draft = await _get_owned_draft(draft_id, user, db)
    return DraftOut.model_validate(draft)


@router.patch("/{draft_id}", response_model=DraftOut)
async def update(
    draft_id: str,
    body: DraftIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DraftOut:
    draft = await _get_owned_draft(draft_id, user, db)
    if body.title is not None:
        draft.title = body.title
    if body.summary is not None:
        draft.summary = body.summary
    if body.content is not None:
        draft.content = body.content
    if body.category is not None:
        draft.category = body.category
    if body.tags is not None:
        draft.tags = list(body.tags)
    await db.commit()
    await db.refresh(draft)
    return DraftOut.model_validate(draft)


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    draft_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    draft = await _get_owned_draft(draft_id, user, db)
    await db.delete(draft)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{draft_id}/publish", response_model=NoteOut)
async def publish(
    draft_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteOut:
    draft = await _get_owned_draft(draft_id, user, db)

    if not draft.title.strip():
        raise HTTPException(status_code=422, detail="发布前必须填写标题")
    if not draft.content.strip():
        raise HTTPException(status_code=422, detail="发布前必须填写正文")
    if not draft.category:
        raise HTTPException(status_code=422, detail="发布前必须选择分类")

    summary = draft.summary.strip()
    if not summary:
        # Default fallback is the AI summary (the user opted out of writing one).
        # If DeepSeek is unreachable we still publish — degrade to first-paragraph.
        summary = await ai_compose.summarize_or_fallback(
            draft.content, summary_from(draft.content), title=draft.title
        )

    note = Note(
        id=str(uuid4()),
        title=draft.title,
        summary=summary,
        content=draft.content,
        category=draft.category,
        tags=list(draft.tags),
        author_sid=user.sid,
        created_at=datetime.now(timezone.utc),
        read_minutes=read_minutes_from(draft.content),
    )
    db.add(note)
    await db.delete(draft)
    await db.commit()
    await db.refresh(note)

    return NoteOut(
        id=note.id,
        title=note.title,
        summary=note.summary,
        cover=note.cover,
        category=note.category,  # type: ignore[arg-type]
        tags=list(note.tags),
        author=NoteAuthorOut(sid=user.sid, nickname=user.nickname, avatar=user.avatar),
        created_at=note.created_at,
        likes=0,
        comments=0,
        read_minutes=note.read_minutes,
    )
