"""Notes routes — see BACKEND_SPEC.md §2 (Notes)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Note, User
from app.deps import get_current_user, get_db, get_optional_user
from app.schemas.note import (
    CategoryId,
    ListNotesQuery,
    NoteOut,
    NoteUpdateIn,
    PaginatedNotes,
)
from app.services import ai_compose
from app.services.notes import (
    count_comments,
    count_likes,
    liked_by_user,
    list_notes,
    read_minutes_from,
    summary_from,
    to_note_out,
)

router = APIRouter(tags=["notes"])


@router.get("/notes", response_model=PaginatedNotes)
async def list_(
    cat: CategoryId | None = None,
    q: str | None = None,
    sort: Literal["latest", "hot", "liked"] | None = None,
    tags: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=6, ge=1, le=50),
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> PaginatedNotes:
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    return await list_notes(
        ListNotesQuery(
            cat=cat,
            q=q,
            sort=sort,
            tags=tag_list,
            cursor=cursor,
            limit=limit,
            mine=mine,
        ),
        db,
        user_sid=user.sid if user else None,
    )


@router.get("/notes/hot", response_model=list[NoteOut])
async def hot(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> list[NoteOut]:
    page = await list_notes(
        ListNotesQuery(sort="hot", limit=6), db, user_sid=user.sid if user else None
    )
    return page.items


@router.get("/notes/latest", response_model=list[NoteOut])
async def latest(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> list[NoteOut]:
    page = await list_notes(
        ListNotesQuery(sort="latest", limit=8), db, user_sid=user.sid if user else None
    )
    return page.items


@router.get("/notes/liked", response_model=list[NoteOut])
async def liked(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> list[NoteOut]:
    page = await list_notes(
        ListNotesQuery(sort="liked", limit=6), db, user_sid=user.sid if user else None
    )
    return page.items


@router.get("/notes/get", response_model=NoteOut)
async def get_one(
    id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> NoteOut:
    stmt = select(Note).where(Note.id == id).options(selectinload(Note.author))
    note = (await db.execute(stmt)).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    likes = await count_likes(db, [id])
    comments = await count_comments(db, [id])
    liked_ids = await liked_by_user(db, user.sid if user else None, [id])
    return to_note_out(
        note, likes.get(id, 0), comments.get(id, 0), id in liked_ids
    )


@router.patch("/notes/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str,
    body: NoteUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteOut:
    stmt = select(Note).where(Note.id == note_id).options(selectinload(Note.author))
    note = (await db.execute(stmt)).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if note.author_sid != user.sid:
        raise HTTPException(status_code=403, detail="只能编辑自己的笔记")

    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status_code=422, detail="标题不能为空")
        note.title = body.title
    if body.category is not None:
        note.category = body.category
    if body.tags is not None:
        note.tags = list(body.tags)
    if body.content is not None:
        if not body.content.strip():
            raise HTTPException(status_code=422, detail="正文不能为空")
        note.content = body.content
        note.read_minutes = read_minutes_from(body.content)

    if body.summary is not None:
        stripped = body.summary.strip()
        if stripped:
            note.summary = stripped
        else:
            note.summary = await ai_compose.summarize_or_fallback(
                note.content, summary_from(note.content), title=note.title
            )
    elif body.content is not None:
        note.summary = await ai_compose.summarize_or_fallback(
            body.content, summary_from(body.content), title=note.title
        )

    await db.commit()
    await db.refresh(note)

    likes = await count_likes(db, [note_id])
    comments = await count_comments(db, [note_id])
    liked_ids = await liked_by_user(db, user.sid, [note_id])
    return to_note_out(
        note, likes.get(note_id, 0), comments.get(note_id, 0), note_id in liked_ids
    )


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if note.author_sid != user.sid:
        raise HTTPException(status_code=403, detail="只能删除自己的笔记")
    # CASCADE on Like.note_id / Comment.note_id cleans up children automatically.
    await db.delete(note)
    await db.commit()
