"""Comment query helpers — see BACKEND_SPEC.md §3."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Comment

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


async def list_comments(
    db: AsyncSession,
    note_id: str,
    cursor: str | None,
    limit: int,
) -> tuple[list[Comment], str | None]:
    """Cursor-paginated comment list for one note, newest first.

    Cursor = the previous page's last comment id. We over-fetch by one row to
    detect whether the next page exists without a separate COUNT query.
    """
    capped_limit = max(1, min(limit, MAX_LIMIT))

    stmt = (
        select(Comment)
        .where(Comment.note_id == note_id)
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .limit(capped_limit + 1)
        .options(selectinload(Comment.author))
    )

    if cursor:
        # Anchor pagination on the previous page's last row so the same sort
        # order keeps walking forward.
        anchor = await db.get(Comment, cursor)
        if anchor is not None:
            stmt = stmt.where(
                (Comment.created_at < anchor.created_at)
                | (
                    (Comment.created_at == anchor.created_at)
                    & (Comment.id < anchor.id)
                )
            )

    rows = list((await db.execute(stmt)).scalars().all())
    next_cursor = rows[capped_limit - 1].id if len(rows) > capped_limit else None
    return rows[:capped_limit], next_cursor
