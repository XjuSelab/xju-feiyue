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

    @computed_field(alias="isAdmin")  # type: ignore[prop-decorator]
    @property
    def is_admin(self) -> bool:
        """True iff this user is the configured super-admin (settings.admin_sid).

        Derived (not a column) — so login / /auth/me return it with no route
        change; drives admin-only UI (manage any 资料) on the frontend.
        """
        return self.sid == settings.admin_sid


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
