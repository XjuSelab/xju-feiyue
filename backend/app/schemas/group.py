"""Pydantic schemas for the /groups/* domain (小组 + 组内空间).

Wire format is camelCase (CamelModel). Mirrors frontend
src/api/schemas/class.ts (group section). Dates on the wire are plain
``YYYY-MM-DD`` strings (pydantic ``date``); task assignees are validated
against group membership in the service layer.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field, model_validator

from app.schemas._base import CamelModel, UtcDateTime

GroupRole = Literal["leader", "member"]
JoinRequestStatus = Literal["pending", "approved", "rejected"]
TaskStatus = Literal["todo", "doing", "done"]


class GroupOut(CamelModel):
    """A group card — includes the viewer-relative fields the list UI needs.

    ``my_role`` is None for non-members; ``my_pending_request_id`` carries the
    viewer's own pending join request (for the 申请审核中 button state and the
    cancel action) and is None otherwise.
    """

    id: str
    name: str
    logo: str | None = None
    logo_thumb: str | None = None
    intro: str = ""
    leader_sid: str
    leader_nickname: str = ""
    member_count: int = 0
    my_role: GroupRole | None = None
    my_pending_request_id: str | None = None
    created_at: UtcDateTime


class GroupMemberOut(CamelModel):
    sid: str
    nickname: str
    avatar_thumb: str | None = None
    role: GroupRole
    joined_at: UtcDateTime


class GroupDetailOut(GroupOut):
    """Group space header data: card fields + members + pending-request count."""

    members: list[GroupMemberOut] = Field(default_factory=list)
    pending_count: int = 0


class GroupCreateIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    intro: str | None = Field(default=None, max_length=2000)


class GroupUpdateIn(CamelModel):
    """PATCH /groups/{gid} — partial; omitted = unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    intro: str | None = Field(default=None, max_length=2000)


class JoinRequestCreateIn(CamelModel):
    message: str | None = Field(default=None, max_length=500)


class JoinRequestOut(CamelModel):
    id: str
    group_id: str
    sid: str
    nickname: str
    avatar_thumb: str | None = None
    message: str | None = None
    status: JoinRequestStatus
    created_at: UtcDateTime
    decided_by_sid: str | None = None
    decided_at: UtcDateTime | None = None


class TransferLeaderIn(CamelModel):
    sid: str


class GroupFileOut(CamelModel):
    """A group-space file row. ``size`` is the human string ("1.2 MB")."""

    id: str
    name: str
    ext: str | None = None
    mime: str | None = None
    size: str | None = None
    size_bytes: int | None = None
    url: str | None = None
    uploaded_by_sid: str
    uploaded_by_nickname: str = ""
    created_at: UtcDateTime


class TaskAssigneeOut(CamelModel):
    sid: str
    nickname: str
    avatar_thumb: str | None = None


class GroupTaskOut(CamelModel):
    id: str
    title: str
    description: str = ""
    assignee_sids: list[str] = Field(default_factory=list)
    assignees: list[TaskAssigneeOut] = Field(default_factory=list)
    # Inclusive date range — a one-day task has start_date == end_date.
    start_date: date
    end_date: date
    status: TaskStatus
    progress: int = Field(ge=0, le=100)
    created_by_sid: str
    created_at: UtcDateTime
    updated_at: UtcDateTime


class TaskCreateIn(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    assignee_sids: list[str] = Field(default_factory=list)
    start_date: date
    end_date: date
    status: TaskStatus = "todo"
    progress: int = Field(default=0, ge=0, le=100)

    @model_validator(mode="after")
    def _dates_ordered(self) -> TaskCreateIn:
        if self.end_date < self.start_date:
            raise ValueError("结束日期不能早于开始日期")
        return self


class TaskUpdateIn(CamelModel):
    """PATCH /groups/{gid}/tasks/{tid} — partial; omitted = unchanged.

    ``assignee_sids`` (when present) replaces the whole assignment set.
    Cross-field date ordering is re-checked in the service against the merged
    (existing + patched) values — a partial body can't see both dates here.
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    assignee_sids: list[str] | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: TaskStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
