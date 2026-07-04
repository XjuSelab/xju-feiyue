"""Mirrors frontend src/api/schemas/user.ts.

UserOut is the public+private profile shape — phone/email/wechat are
only ever returned for the current user (PrivilegeS).  When a note's
author is embedded, we use NoteAuthorOut (sid + nickname + avatar) so
we never leak contact info via /notes responses.
"""

from pydantic import Field, computed_field

from app.schemas._base import CamelModel
from app.settings import settings


class UserOut(CamelModel):
    sid: str
    name: str
    nickname: str
    # Greeting form-of-address (derived from name at registration / customized).
    # NULL on legacy rows → frontend derives via familiarName(name).
    preferred_name: str | None = None
    avatar: str | None = None
    avatar_thumb: str | None = None
    bio: str | None = None
    wechat: str | None = None
    phone: str | None = None
    email: str | None = None
    # Authorization tier ('user' | 'admin' | 'superadmin'). Populated from the
    # users.role column; legacy/absent → 'user'. Drives the hidden /admin
    # dashboard + material-management UI on the frontend.
    role: str = "user"
    # 班级 — flattened from the classes table via User.class_full_name /
    # class_short_name properties (the wire keeps the two-field shape the
    # product spec asked for). Admin-managed; NULL until assigned.
    class_id: int | None = None
    class_full_name: str | None = None
    class_short_name: str | None = None
    # 班委 flag — roll-call / group-approval powers within the user's class.
    is_class_committee: bool = False
    # 班委职务名称 (班长 / 团支书 / …) — display only; NULL on legacy 班委.
    committee_title: str | None = None

    @computed_field(alias="isAdmin")  # type: ignore[prop-decorator]
    @property
    def is_admin(self) -> bool:
        """True for admin OR superadmin (the /admin-capable + manage-any-资料 set).

        Derived (not a column) — login / /auth/me return it with no route
        change. The configured bootstrap super-admin (settings.admin_sid) is
        always included even if its role column lags (mirrors
        services.auth.effective_role).
        """
        return self.role in ("admin", "superadmin") or self.sid == settings.admin_sid

    @computed_field(alias="isSuperAdmin")  # type: ignore[prop-decorator]
    @property
    def is_super_admin(self) -> bool:
        """True iff superadmin (can (de)promote admins). admin_sid always wins."""
        return self.role == "superadmin" or self.sid == settings.admin_sid


class NoteAuthorOut(CamelModel):
    """Embedded shape when serializing notes — no contact fields."""

    sid: str
    nickname: str
    avatar: str | None = None
    avatar_thumb: str | None = None


class LoginIn(CamelModel):
    sid: str = Field(pattern=r"^\d{11}$", description="11-digit student ID")
    password: str = Field(min_length=1)


class LoginOut(CamelModel):
    user: UserOut
    token: str = Field(min_length=1)


class UserMeUpdate(CamelModel):
    """PATCH /auth/me — every field optional, missing = unchanged."""

    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    wechat: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=128)


class PasswordChangeIn(CamelModel):
    """POST /auth/me/password — must supply the existing password."""

    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)
