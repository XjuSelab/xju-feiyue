"""Pydantic schemas for the /classes/* domain (班级空间 + 点名).

Wire format is camelCase (CamelModel). Mirrors frontend
src/api/schemas/class.ts. All regular-user endpoints are scoped to *my*
class (derived from the JWT user's ``class_id``) — no class ids appear in
user-facing URLs, so no cross-class access is even expressible.
"""

from __future__ import annotations

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime


class ClassMeOut(CamelModel):
    """GET /classes/me — the caller's class, or all-null when unassigned.

    Deliberately 200-with-nulls (not 404) for classless users so the frontend
    renders a friendly "联系管理员" empty state instead of an error path.
    """

    class_id: int | None = None
    class_full_name: str | None = None
    class_short_name: str | None = None
    is_class_committee: bool = False
    # 自己的班委职务名称（页头徽标）；非班委 / legacy 班委为 None。
    committee_title: str | None = None
    member_count: int = 0


class ClassMemberOut(CamelModel):
    """A classmate row — no contact fields (NoteAuthorOut ethos)."""

    sid: str
    nickname: str
    name: str
    avatar_thumb: str | None = None
    is_class_committee: bool = False
    # 班委职务名称 (班长 / 团支书 / …)；驱动成员列表的着色徽标。
    committee_title: str | None = None


class RollCallCreateIn(CamelModel):
    """POST /classes/me/rollcalls — optional label like 「软件工程第3周」."""

    title: str | None = Field(default=None, max_length=120)


class RollCallUpdateIn(CamelModel):
    """PATCH /classes/me/rollcalls/{id} — partial; omitted = unchanged.

    ``closed=True`` stamps ``closed_at`` (完成点名); ``closed=False`` reopens.
    Records stay editable either way — closing is informational.
    """

    title: str | None = Field(default=None, max_length=120)
    closed: bool | None = None


class RollCallSummaryOut(CamelModel):
    """History-list row: who ran it, when, and the 出勤 x/y counts."""

    id: str
    title: str | None = None
    created_by_sid: str
    created_by_nickname: str
    created_at: UtcDateTime
    closed_at: UtcDateTime | None = None
    present_count: int
    total_count: int


class RollCallRecordOut(CamelModel):
    sid: str
    nickname: str
    avatar_thumb: str | None = None
    present: bool
    checked_at: UtcDateTime | None = None


class RollCallDetailOut(RollCallSummaryOut):
    """Summary + the full per-member checkbox roster."""

    records: list[RollCallRecordOut] = Field(default_factory=list)


class RollCallRecordIn(CamelModel):
    """PUT /classes/me/rollcalls/{id}/records/{sid} — one checkbox click."""

    present: bool


class MissionOut(CamelModel):
    """A 分组任务 (grouping mission) — the top layer of the /class space.

    ``is_active`` marks the 进行中 mission (at most one per class). Every class
    member reads these; 班委 create/edit/activate them.
    """

    id: str
    title: str
    description: str = ""
    is_active: bool = False
    created_by_sid: str
    created_at: UtcDateTime
    updated_at: UtcDateTime


class MissionCreateIn(CamelModel):
    """POST /classes/me/missions — new 分组任务.

    ``active`` (default True) sets it as the 进行中 mission on creation, unsetting
    any prior active one — the common case is "start a new round of grouping".
    """

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    active: bool = True


class MissionUpdateIn(CamelModel):
    """PATCH /classes/me/missions/{id} — partial; omitted = unchanged.

    ``active=True`` makes this the 进行中 mission (unsets the others); ``active``
    is never accepted as False here — deactivate by activating another mission.
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    active: bool | None = None


class MemberCommitteeIn(CamelModel):
    """POST /classes/me/members/{sid}/committee — 班内设置班委.

    Actor must be superadmin OR the class's 班长; assigning the 班长 title
    itself (and touching an existing 班长) is superadmin-only — see the
    route for the full rule set.
    """

    is_class_committee: bool
    committee_title: str | None = Field(default=None, max_length=32)
