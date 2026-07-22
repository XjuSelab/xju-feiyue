"""Schemas for the /admin dashboard (mirrors frontend features/admin).

Wire format is camelCase (CamelModel). These are admin-only payloads —
`AdminUserRow` intentionally carries contact + audit fields that the public
`UserOut` never leaks, because only admins ever see this surface.
"""

from typing import Literal

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime

# The two roles a super-admin may assign via the UI. 'superadmin' is NOT
# assignable (bootstrap-only, see services.auth.effective_role).
AssignableRole = Literal["user", "admin"]


class AdminUserRow(CamelModel):
    """One row in the admin user table."""

    sid: str
    name: str
    nickname: str
    role: str
    is_lab_member: bool = False
    email: str | None = None
    phone: str | None = None
    avatar_thumb: str | None = None
    note_count: int = 0
    material_count: int = 0
    # 班级 (flattened from the classes table) + 班委 flag — admin-managed.
    class_id: int | None = None
    class_short_name: str | None = None
    is_class_committee: bool = False
    committee_title: str | None = None
    last_login_at: UtcDateTime | None = None
    created_at: UtcDateTime | None = None


class UserCreateIn(CamelModel):
    """POST /admin/users — import a single user (default password applied)."""

    sid: str = Field(pattern=r"^\d{11}$", description="11-digit student ID")
    name: str = Field(min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, min_length=1, max_length=120)
    # Optional initial password; falls back to the shared default (123456).
    password: str | None = Field(default=None, min_length=6, max_length=128)
    # Optional 班级 assignment at import time (must reference an existing row).
    class_id: int | None = None


class ResetPasswordIn(CamelModel):
    """POST /admin/users/{sid}/reset-password — omit password ⇒ default 123456."""

    password: str | None = Field(default=None, min_length=6, max_length=128)


class ResetPasswordOut(CamelModel):
    sid: str
    # Echo the password that was set so the admin can hand it to the user.
    password: str


class SetRoleIn(CamelModel):
    """POST /admin/users/{sid}/role — promote/demote (super-admin only)."""

    role: AssignableRole


class SetLabMemberIn(CamelModel):
    """POST /admin/users/{sid}/lab-member — super-admin only."""

    is_lab_member: bool


# --- 班级 management ---------------------------------------------------------


class AdminClassOut(CamelModel):
    """One row in the admin class list (with usage counts for safe delete)."""

    id: int
    full_name: str
    short_name: str
    student_count: int = 0
    committee_count: int = 0


class ClassCreateIn(CamelModel):
    """POST /admin/classes — e.g. 计算机科学与技术24-3 / 计算机24-3."""

    full_name: str = Field(min_length=1, max_length=120)
    short_name: str = Field(min_length=1, max_length=64)


class ClassUpdateIn(CamelModel):
    """PATCH /admin/classes/{id} — the rename path; users/groups follow via FK."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    short_name: str | None = Field(default=None, min_length=1, max_length=64)


class SetClassIn(CamelModel):
    """POST /admin/users/{sid}/class — null clears (and drops the 班委 flag)."""

    class_id: int | None = None


class SetCommitteeIn(CamelModel):
    """POST /admin/users/{sid}/committee — toggle the 班委 flag.

    ``committee_title`` (班长 / 团支书 / 学习委员 …) is display-only and only
    meaningful when setting the flag; omitted → generic「班委」. Clearing the
    flag always clears the title.
    """

    is_class_committee: bool
    committee_title: str | None = Field(default=None, max_length=32)


# --- /admin/stats ----------------------------------------------------------


class RoleCount(CamelModel):
    role: str
    count: int


class DayCount(CamelModel):
    """One bucket of the login-activity sparkline (YYYY-MM-DD, local day)."""

    date: str
    count: int


class TopUploader(CamelModel):
    sid: str
    nickname: str
    file_count: int
    size_bytes: int


class RecentSignup(CamelModel):
    sid: str
    nickname: str
    role: str
    created_at: UtcDateTime | None = None


class AdminStats(CamelModel):
    total_users: int
    total_admins: int  # admin + superadmin
    total_notes: int
    total_resources: int
    total_files: int
    total_storage_bytes: int
    logins_today: int
    role_breakdown: list[RoleCount]
    login_activity: list[DayCount]  # last 14 days, oldest → newest
    top_uploaders: list[TopUploader]
    recent_signups: list[RecentSignup]
