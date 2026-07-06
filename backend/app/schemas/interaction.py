"""Likes / Comments — see BACKEND_SPEC.md §3."""
from __future__ import annotations

from pydantic import Field, model_validator

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import NoteAuthorOut


class CommentIn(CamelModel):
    content: str = Field(min_length=1, max_length=4000)
    parent_id: str | None = None
    reply_to_sid: str | None = None
    images: list[str] = Field(default_factory=list, max_length=9)
    # Optional anchor — quote a span of the note's rendered body.
    anchor_text: str | None = Field(default=None, max_length=4000)
    anchor_offset_start: int | None = Field(default=None, ge=0)
    anchor_offset_end: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_shape(self) -> CommentIn:
        has_start = self.anchor_offset_start is not None
        has_end = self.anchor_offset_end is not None
        if has_start != has_end:
            raise ValueError("锚点偏移必须成对提供")
        if has_start and has_end and self.anchor_offset_end <= self.anchor_offset_start:
            raise ValueError("anchorOffsetEnd 必须大于 anchorOffsetStart")
        if self.reply_to_sid is not None and self.parent_id is None:
            raise ValueError("replyToSid 仅可用于楼内回复")
        return self


class CommentOut(CamelModel):
    id: str
    note_id: str
    author: NoteAuthorOut
    content: str
    created_at: UtcDateTime
    parent_id: str | None = None
    reply_to_sid: str | None = None
    reply_to: NoteAuthorOut | None = None
    images: list[str] = Field(default_factory=list)
    status: str = "visible"
    likes: int = Field(default=0, ge=0)
    dislikes: int = Field(default=0, ge=0)
    liked_by_me: bool = False
    disliked_by_me: bool = False
    anchor_text: str | None = None
    anchor_offset_start: int | None = None
    anchor_offset_end: int | None = None


class PaginatedComments(CamelModel):
    items: list[CommentOut]
    next_cursor: str | None = None