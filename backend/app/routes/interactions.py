"""Likes / Comments — see BACKEND_SPEC.md §2 (Interactions)."""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db.models import Comment, Like, Note, User
from app.deps import get_current_user, get_db
from app.schemas.interaction import CommentIn, CommentOut, PaginatedComments
from app.schemas.note import NoteAuthorOut
from app.services.comments import DEFAULT_LIMIT, list_comments

router = APIRouter(tags=["interactions"])


@router.post("/notes/{note_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def like(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    # Idempotent: composite PK (note_id, user_sid). db.get returns None when
    # this user hasn't liked the note yet — dialect-agnostic upsert.
    existing = await db.get(Like, (note_id, user.sid))
    if existing is None:
        db.add(Like(note_id=note_id, user_sid=user.sid))
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/notes/{note_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    # Idempotent: missing rows still 204.
    await db.execute(
        delete(Like).where(Like.note_id == note_id, Like.user_sid == user.sid)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _to_comment_out(c: Comment) -> CommentOut:
    return CommentOut(
        id=c.id,
        note_id=c.note_id,
        author=NoteAuthorOut(
            sid=c.author.sid,
            nickname=c.author.nickname,
            avatar=c.author.avatar,
            avatar_thumb=c.author.avatar_thumb,
        ),
        content=c.content,
        created_at=c.created_at,
        anchor_text=c.anchor_text,
        anchor_offset_start=c.anchor_offset_start,
        anchor_offset_end=c.anchor_offset_end,
    )


@router.get("/notes/{note_id}/comments", response_model=PaginatedComments)
async def list_comments_route(
    note_id: str,
    cursor: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedComments:
    rows, next_cursor = await list_comments(db, note_id, cursor, limit)
    return PaginatedComments(
        items=[_to_comment_out(c) for c in rows],
        next_cursor=next_cursor,
    )


@router.post(
    "/notes/{note_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    note_id: str,
    body: CommentIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    comment = Comment(
        id=str(uuid4()),
        note_id=note_id,
        author_sid=user.sid,
        content=body.content,
        anchor_text=body.anchor_text,
        anchor_offset_start=body.anchor_offset_start,
        anchor_offset_end=body.anchor_offset_end,
    )
    db.add(comment)
    await db.commit()

    # Re-fetch with the author eagerly loaded so _to_comment_out doesn't
    # trigger a lazy-load (Comment.author is lazy="joined" by default but the
    # session may have evicted it after commit).
    stmt = (
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.author))
    )
    fresh = (await db.execute(stmt)).scalar_one()
    return _to_comment_out(fresh)


@router.delete(
    "/notes/{note_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment(
    note_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    comment = await db.get(Comment, comment_id)
    if not comment or comment.note_id != note_id:
        raise HTTPException(status_code=404, detail="评论不存在")

    if comment.author_sid != user.sid:
        # Note author may delete any comment on their own note.
        note = await db.get(Note, note_id)
        if not note or note.author_sid != user.sid:
            raise HTTPException(status_code=403, detail="只能删除自己的评论")

    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
