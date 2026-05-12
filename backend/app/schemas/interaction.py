"""Likes / Comments — see BACKEND_SPEC.md §3."""
from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import NoteAuthorOut


class CommentIn(CamelModel):
    content: str = Field(min_length=1, max_length=4000)
    # Optional anchor — quote a span of the note's rendered body.
    anchor_text: str | None = Field(default=None, max_length=4000)
    anchor_offset_start: int | None = Field(default=None, ge=0)
    anchor_offset_end: int | None = Field(default=None, ge=0)


class CommentOut(CamelModel):
    id: str
    note_id: str
    author: NoteAuthorOut
    content: str
    created_at: UtcDateTime
    anchor_text: str | None = None
    anchor_offset_start: int | None = None
    anchor_offset_end: int | None = None


class PaginatedComments(CamelModel):
    items: list[CommentOut]
    next_cursor: str | None = None
