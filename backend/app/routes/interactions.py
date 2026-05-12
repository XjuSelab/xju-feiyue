"""Likes / Comments — see BACKEND_SPEC.md §2 (Interactions)."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Like, Note, User
from app.deps import get_current_user, get_db
from app.schemas.interaction import CommentIn, CommentOut, PaginatedComments

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


@router.get("/notes/{note_id}/comments", response_model=PaginatedComments)
async def list_comments(
    note_id: str, cursor: str | None = None, limit: int = 20
) -> PaginatedComments:
    return PaginatedComments(items=[], next_cursor=None)


@router.post(
    "/notes/{note_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    note_id: str, body: CommentIn, user: User = Depends(get_current_user)
) -> CommentOut:
    raise HTTPException(status_code=501, detail="comments: phase 6")


@router.delete(
    "/notes/{note_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment(
    note_id: str, comment_id: str, user: User = Depends(get_current_user)
) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
