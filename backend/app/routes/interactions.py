"""Likes / Comments — Phase 6 will fill in."""
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.db.models import User
from app.deps import get_current_user
from app.schemas.interaction import CommentIn, CommentOut, PaginatedComments

router = APIRouter(tags=["interactions"])


@router.post("/notes/{note_id}/like", status_code=status.HTTP_200_OK)
async def like(note_id: str, user: User = Depends(get_current_user)) -> dict[str, bool]:
    return {"ok": True}


@router.delete("/notes/{note_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike(note_id: str, user: User = Depends(get_current_user)) -> Response:
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
