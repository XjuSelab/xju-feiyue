"""SQLAlchemy ORM models — single source of truth for the DB schema.

The 7 categories are kept as a Python `Literal` (mirroring frontend
`CategoryId`) and stored as a string column. Postgres has a native enum
type, but using strings keeps SQLite-fallback workable for tests.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, TypeDecorator

from app.db.base import Base

if TYPE_CHECKING:
    pass


class StringList(TypeDecorator):
    """Use ARRAY(Text) on Postgres, JSON on SQLite. Keeps tests cheap."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):  # type: ignore[no-untyped-def]
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(Text))
        return dialect.type_descriptor(JSON())


CATEGORY_VALUES = (
    "research",
    "course",
    "recommend",
    "competition",
    "kaggle",
    "tools",
    "life",
)


class User(Base):
    __tablename__ = "users"

    # Student ID is the natural primary key — 11-digit numeric string.
    sid: Mapped[str] = mapped_column(String(11), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Displayed across the app (cards / detail header / dropdown). Mutable;
    # seeded equal to `name` on first registration.
    nickname: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Server-generated 160px thumbnail derived from `avatar` on upload.
    # Cards / lists use this so we're not making the browser downsample a
    # 4 K portrait into a 20 px chip.
    avatar_thumb: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    wechat: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    notes: Mapped[list[Note]] = relationship(back_populates="author", lazy="raise")
    drafts: Mapped[list[Draft]] = relationship(back_populates="owner", lazy="raise")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover: Mapped[str | None] = mapped_column(String(512), nullable=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    tags: Mapped[list[str]] = mapped_column(StringList(), nullable=False, default=list)
    author_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    read_minutes: Mapped[int] = mapped_column(nullable=False, default=1)

    author: Mapped[User] = relationship(back_populates="notes", lazy="joined")
    # passive_deletes=True: rely on DB-level ondelete='CASCADE' instead of
    # having SQLAlchemy try to NULL the FK first (which would violate Like's
    # PK constraint since note_id is part of its composite primary key).
    likes: Mapped[list[Like]] = relationship(
        back_populates="note", lazy="raise", passive_deletes=True
    )
    comments: Mapped[list[Comment]] = relationship(
        back_populates="note", lazy="raise", passive_deletes=True
    )


class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tags: Mapped[list[str]] = mapped_column(StringList(), nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )

    owner: Mapped[User] = relationship(back_populates="drafts", lazy="joined")


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("note_id", "user_sid", name="uq_likes_note_user"),)

    note_id: Mapped[str] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    user_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    note: Mapped[Note] = relationship(back_populates="likes", lazy="raise")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    note_id: Mapped[str] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    note: Mapped[Note] = relationship(back_populates="comments", lazy="raise")
    author: Mapped[User] = relationship(lazy="joined")


class LoginEvent(Base):
    """Successful-login audit trail — admin-visible only.

    Captures the client IP from the reverse-proxy headers (X-Forwarded-For
    / X-Real-IP), the User-Agent, and a server timestamp.
    """

    __tablename__ = "login_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), nullable=False, index=True
    )
    ip: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
