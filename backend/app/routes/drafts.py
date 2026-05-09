"""Drafts routes — Phase 5 will fill in CRUD + publish."""
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.db.models import User
from app.deps import get_current_user
from app.schemas.draft import DraftIn, DraftOut
from app.schemas.note import NoteOut

router = APIRouter(prefix="/notes/drafts", tags=["drafts"])


@router.post("", response_model=DraftOut, status_code=status.HTTP_201_CREATED)
async def create(body: DraftIn, user: User = Depends(get_current_user)) -> DraftOut:
    raise HTTPException(status_code=501, detail="drafts: phase 5")


@router.get("", response_model=list[DraftOut])
async def list_mine(user: User = Depends(get_current_user)) -> list[DraftOut]:
    return []


@router.get("/{draft_id}", response_model=DraftOut)
async def get_one(draft_id: str, user: User = Depends(get_current_user)) -> DraftOut:
    raise HTTPException(status_code=404, detail="草稿不存在")


@router.patch("/{draft_id}", response_model=DraftOut)
async def update(
    draft_id: str, body: DraftIn, user: User = Depends(get_current_user)
) -> DraftOut:
    raise HTTPException(status_code=501, detail="drafts: phase 5")


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(draft_id: str, user: User = Depends(get_current_user)) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{draft_id}/publish", response_model=NoteOut)
async def publish(draft_id: str, user: User = Depends(get_current_user)) -> NoteOut:
    raise HTTPException(status_code=501, detail="drafts: phase 5")
