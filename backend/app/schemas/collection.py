"""Collection / sidebar schemas."""
from __future__ import annotations

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import CategoryId, NoteAuthorOut


class CollectionCreateIn(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)


class CollectionUpdateIn(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)


class CollectionEntryAddIn(CamelModel):
    note_id: str
    sort_order: int | None = Field(default=None, ge=0)


class CollectionReorderIn(CamelModel):
    """Full ordered list of note ids for a collection (drag-sort)."""

    note_ids: list[str]


class CollectionNoteOut(CamelModel):
    id: str
    title: str
    summary: str
    category: CategoryId
    created_at: UtcDateTime
    read_minutes: int = Field(ge=1)
    author: NoteAuthorOut


class CollectionOut(CamelModel):
    id: str
    title: str
    description: str = ""
    entry_count: int = Field(default=0, ge=0)
    created_at: UtcDateTime
    updated_at: UtcDateTime


class CollectionDetailOut(CollectionOut):
    entries: list[CollectionNoteOut] = Field(default_factory=list)


class NoteCollectionContextOut(CamelModel):
    collection: CollectionOut
    entries: list[CollectionNoteOut] = Field(default_factory=list)
    current_index: int = Field(ge=0)