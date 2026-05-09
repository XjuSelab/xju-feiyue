"""Notes routes — see BACKEND_SPEC.md §2 (Notes)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Note
from app.deps import get_db
from app.schemas.note import (
    CategoryId,
    ListNotesQuery,
    NoteOut,
    PaginatedNotes,
)
from app.services.notes import (
    count_comments,
    count_likes,
    list_notes,
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
    db: AsyncSession = Depends(get_db),
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
        ),
        db,
    )


@router.get("/notes/hot", response_model=list[NoteOut])
async def hot(db: AsyncSession = Depends(get_db)) -> list[NoteOut]:
    page = await list_notes(ListNotesQuery(sort="hot", limit=6), db)
    return page.items


@router.get("/notes/latest", response_model=list[NoteOut])
async def latest(db: AsyncSession = Depends(get_db)) -> list[NoteOut]:
    page = await list_notes(ListNotesQuery(sort="latest", limit=8), db)
    return page.items


@router.get("/notes/liked", response_model=list[NoteOut])
async def liked(db: AsyncSession = Depends(get_db)) -> list[NoteOut]:
    page = await list_notes(ListNotesQuery(sort="liked", limit=6), db)
    return page.items


@router.get("/notes/get", response_model=NoteOut)
async def get_one(id: str, db: AsyncSession = Depends(get_db)) -> NoteOut:
    stmt = select(Note).where(Note.id == id).options(selectinload(Note.author))
    note = (await db.execute(stmt)).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    likes = await count_likes(db, [id])
    comments = await count_comments(db, [id])
    return to_note_out(note, likes.get(id, 0), comments.get(id, 0))
