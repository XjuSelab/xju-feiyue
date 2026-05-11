"""Notes query helpers — see BACKEND_SPEC.md §2 (Notes).

The list endpoint loads all rows matching the basic SQL filters (cat, q)
and then sorts / paginates / does tag filtering Python-side. With the
fixture's 14 notes this is trivially fast; if production grows beyond a
few thousand notes, switch to keyset pagination on the sort key directly
and use Postgres ARRAY overlap for tags.
"""
from __future__ import annotations

from collections.abc import Iterable
from typing import cast

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Comment, Like, Note
from app.schemas.note import (
    CategoryId,
    ListNotesQuery,
    NoteAuthorOut,
    NoteOut,
    PaginatedNotes,
)

DEFAULT_LIMIT = 6
MAX_LIMIT = 50


async def count_likes(db: AsyncSession, note_ids: Iterable[str]) -> dict[str, int]:
    ids = list(note_ids)
    if not ids:
        return {}
    stmt = (
        select(Like.note_id, func.count(Like.user_sid))
        .where(Like.note_id.in_(ids))
        .group_by(Like.note_id)
    )
    return {row[0]: row[1] for row in await db.execute(stmt)}


async def count_comments(db: AsyncSession, note_ids: Iterable[str]) -> dict[str, int]:
    ids = list(note_ids)
    if not ids:
        return {}
    stmt = (
        select(Comment.note_id, func.count(Comment.id))
        .where(Comment.note_id.in_(ids))
        .group_by(Comment.note_id)
    )
    return {row[0]: row[1] for row in await db.execute(stmt)}


def to_note_out(note: Note, likes: int, comments: int) -> NoteOut:
    return NoteOut(
        id=note.id,
        title=note.title,
        summary=note.summary,
        content=note.content or "",
        cover=note.cover,
        category=cast(CategoryId, note.category),
        tags=list(note.tags or []),
        author=NoteAuthorOut(
            sid=note.author.sid,
            nickname=note.author.nickname,
            avatar=note.author.avatar,
            avatar_thumb=note.author.avatar_thumb,
        ),
        created_at=note.created_at,
        likes=likes,
        comments=comments,
        read_minutes=note.read_minutes,
    )


async def list_notes(query: ListNotesQuery, db: AsyncSession) -> PaginatedNotes:
    stmt = select(Note).options(selectinload(Note.author))
    if query.cat:
        stmt = stmt.where(Note.category == query.cat)
    if query.q:
        like = f"%{query.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Note.title).like(like),
                func.lower(Note.summary).like(like),
            )
        )

    notes_orm = list((await db.execute(stmt)).scalars().all())

    # Tag filtering — Python-side because the StringList column is JSON on
    # SQLite (no overlap operator). On Postgres ARRAY this could move to SQL
    # via Note.tags.overlap(query.tags).
    if query.tags:
        wanted = set(query.tags)
        notes_orm = [n for n in notes_orm if wanted.intersection(n.tags or [])]

    note_ids = [n.id for n in notes_orm]
    likes = await count_likes(db, note_ids)
    comments = await count_comments(db, note_ids)

    rows: list[tuple[Note, int, int]] = [
        (n, likes.get(n.id, 0), comments.get(n.id, 0)) for n in notes_orm
    ]

    sort = query.sort or "latest"
    if sort == "hot":
        rows.sort(key=lambda r: (-(r[1] + r[2]), -r[0].created_at.timestamp()))
    elif sort == "liked":
        rows.sort(key=lambda r: (-r[1], -r[0].created_at.timestamp()))
    else:  # latest
        rows.sort(key=lambda r: -r[0].created_at.timestamp())

    start = 0
    if query.cursor:
        for i, (n, _l, _c) in enumerate(rows):
            if n.id == query.cursor:
                start = i + 1
                break

    limit = min(query.limit or DEFAULT_LIMIT, MAX_LIMIT)
    page = rows[start : start + limit]

    has_more = start + limit < len(rows)
    next_cursor = page[-1][0].id if has_more and page else None

    return PaginatedNotes(
        items=[to_note_out(n, like_count, c) for n, like_count, c in page],
        next_cursor=next_cursor,
    )
