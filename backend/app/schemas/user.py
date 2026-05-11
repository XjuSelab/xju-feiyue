"""Mirrors frontend src/api/schemas/user.ts.

UserOut is the public+private profile shape — phone/email/wechat are
only ever returned for the current user (PrivilegeS).  When a note's
author is embedded, we use NoteAuthorOut (sid + nickname + avatar) so
we never leak contact info via /notes responses.
"""
from pydantic import Field

from app.schemas._base import CamelModel


class UserOut(CamelModel):
    sid: str
    name: str
    nickname: str
    avatar: str | None = None
    bio: str | None = None
    wechat: str | None = None
    phone: str | None = None
    email: str | None = None


class NoteAuthorOut(CamelModel):
    """Embedded shape when serializing notes — no contact fields."""

    sid: str
    nickname: str
    avatar: str | None = None


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
    bio: str | None = Field(default=None, max_length=2000)
    wechat: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=128)


class PasswordChangeIn(CamelModel):
    """POST /auth/me/password — must supply the existing password."""

    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)
