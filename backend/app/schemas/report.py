"""Governance schemas — reports, moderation resolutions, blocks."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import NoteAuthorOut

ReportReason = Literal[
    "spam",
    "harassment",
    "sexual",
    "illegal",
    "misinfo",
    "infringement",
    "other",
]
ReportTargetType = Literal["note", "comment"]
ResolutionAction = Literal["hide", "delete", "dismiss"]


class ReportCreateIn(CamelModel):
    target_type: ReportTargetType
    target_id: str
    reason: ReportReason
    description: str | None = Field(default=None, max_length=1000)


class ReportResolveIn(CamelModel):
    action: ResolutionAction
    comment: str | None = Field(default=None, max_length=1000)


class ReportOut(CamelModel):
    id: str
    target_type: str
    target_note_id: str | None = None
    target_comment_id: str | None = None
    target_snapshot: str = ""
    reason: str
    description: str | None = None
    status: str
    ai_label: str | None = None
    ai_confidence: float | None = None
    ai_reason: str | None = None
    resolution_action: str | None = None
    resolution_comment: str | None = None
    resolved_by_sid: str | None = None
    resolved_at: UtcDateTime | None = None
    created_at: UtcDateTime
    updated_at: UtcDateTime
    reporter: NoteAuthorOut | None = None


class BlockOut(CamelModel):
    user: NoteAuthorOut
    created_at: UtcDateTime
