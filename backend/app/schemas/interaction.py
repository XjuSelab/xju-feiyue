"""Likes / Comments — see BACKEND_SPEC.md §3."""
from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import NoteAuthorOut


class CommentIn(CamelModel):
    content: str = Field(min_length=1, max_length=4000)


class CommentOut(CamelModel):
    id: str
    note_id: str
    author: NoteAuthorOut
    content: str
    created_at: UtcDateTime


class PaginatedComments(CamelModel):
    items: list[CommentOut]
    next_cursor: str | None = None
