"""Notes routes — Phase 4 will fill in the SQL.

Stubs return empty lists / 404 so the OpenAPI surface is correct from
Phase 1 boot.
"""
from fastapi import APIRouter, HTTPException, Query

from app.schemas.note import CategoryId, NoteOut, PaginatedNotes

router = APIRouter(tags=["notes"])


@router.get("/notes", response_model=PaginatedNotes)
async def list_notes(
    cat: CategoryId | None = None,
    q: str | None = None,
    sort: str | None = None,
    tags: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=6, ge=1, le=50),
) -> PaginatedNotes:
    return PaginatedNotes(items=[], next_cursor=None)


@router.get("/notes/hot", response_model=list[NoteOut])
async def hot() -> list[NoteOut]:
    return []


@router.get("/notes/latest", response_model=list[NoteOut])
async def latest() -> list[NoteOut]:
    return []


@router.get("/notes/liked", response_model=list[NoteOut])
async def liked() -> list[NoteOut]:
    return []


@router.get("/notes/get", response_model=NoteOut)
async def get_one(id: str) -> NoteOut:
    raise HTTPException(status_code=404, detail="笔记不存在")
