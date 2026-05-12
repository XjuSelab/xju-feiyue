"""Mirrors frontend src/api/schemas/note.ts (NoteSchema, ListNotesQuery, PaginatedNotes)."""
from typing import Literal

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime

CategoryId = Literal[
    "research", "course", "recommend", "competition", "kaggle", "tools", "life"
]


class NoteAuthorOut(CamelModel):
    """Embedded author payload on /notes — keeps contact fields out of public list."""

    sid: str
    nickname: str
    avatar: str | None = None
    avatar_thumb: str | None = None


class NoteOut(CamelModel):
    id: str
    title: str
    summary: str
    content: str = ""
    cover: str | None = None
    category: CategoryId
    tags: list[str] = Field(default_factory=list)
    author: NoteAuthorOut
    created_at: UtcDateTime
    likes: int = Field(ge=0)
    comments: int = Field(ge=0)
    read_minutes: int = Field(ge=1)
    liked_by_me: bool = False


class NoteUpdateIn(CamelModel):
    """Partial update body for PATCH /notes/{id}. Mirrors DraftIn."""

    title: str | None = None
    content: str | None = None
    category: CategoryId | None = None
    tags: list[str] | None = None


class ListNotesQuery(CamelModel):
    cat: CategoryId | None = None
    q: str | None = None
    sort: Literal["latest", "hot", "liked"] | None = None
    tags: list[str] | None = None
    cursor: str | None = None
    limit: int | None = Field(default=None, ge=1, le=50)
    # When true, restrict results to the authenticated user's own notes.
    # Ignored (treated as false) when no bearer token is presented.
    mine: bool | None = None


class PaginatedNotes(CamelModel):
    items: list[NoteOut]
    next_cursor: str | None = None
