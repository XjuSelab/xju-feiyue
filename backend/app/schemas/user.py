"""Mirrors frontend src/api/schemas/user.ts (UserSchema, LoginRequest, LoginResponse)."""
from pydantic import Field

from app.schemas._base import CamelModel


class UserOut(CamelModel):
    id: str
    sid: str
    name: str
    avatar: str | None = None
    bio: str | None = None


class LoginIn(CamelModel):
    sid: str = Field(pattern=r"^\d{11}$", description="11-digit student ID")
    password: str = Field(min_length=1)


class LoginOut(CamelModel):
    user: UserOut
    token: str = Field(min_length=1)
