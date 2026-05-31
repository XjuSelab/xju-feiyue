"""SQLAlchemy ORM models — single source of truth for the DB schema.

The 7 categories are kept as a Python `Literal` (mirroring frontend
`CategoryId`) and stored as a string column. Postgres has a native enum
type, but using strings keeps SQLite-fallback workable for tests.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
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
    # Greeting form-of-address: derived from the legal name at registration
    # (interpunct → first segment / ≤2 chars → whole / ≥3 chars → trailing
    # two), or user-customized. NULL for legacy rows → derived at runtime via
    # greeting.familiar_name(name). Drives the personalized homepage greeting.
    preferred_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
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
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
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
    # Optional anchor — when present, the comment quotes a span of the note's
    # rendered body. Offsets index into the rendered DOM textContent stream
    # (kept for future highlight-restoration; MVP only uses anchor_text).
    anchor_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    anchor_offset_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anchor_offset_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
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


class MaterialResource(Base):
    """A shared course-material resource — a card on the `/materials` page.

    The resource is the top-level container; its files/folders live in
    `MaterialFile` as a self-referential recursive tree. `deleted` is a
    soft-delete flag (recoverable / auditable); physical files are unlinked
    at DELETE time to avoid orphans on disk.

    House rules (mirroring Note/Like): relationships are `lazy="raise"` +
    `passive_deletes=True` + DB `ondelete='CASCADE'`. We never use
    `cascade="all, delete-orphan"` — the DB drives the cascade.
    """

    __tablename__ = "material_resources"

    # uuid hex (no dashes) PK — same convention as Note/Draft string ids.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 'New' | 'Hot' | 'Rec' (nullable) — drives the corner badge on the card.
    tag: Mapped[str | None] = mapped_column(String(16), nullable=True)
    owner_sid: Mapped[str] = mapped_column(
        ForeignKey("users.sid", ondelete="CASCADE"), nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped[User] = relationship(lazy="joined")
    # passive_deletes=True: rely on DB-level ondelete='CASCADE' rather than
    # SQLAlchemy NULLing FKs first. lazy='raise' forbids implicit IO — the
    # tree is assembled by a flat SELECT + Python grouping in the service.
    files: Mapped[list[MaterialFile]] = relationship(
        back_populates="resource", lazy="raise", passive_deletes=True
    )


class MaterialFile(Base):
    """A file or folder inside a `MaterialResource` (self-referential tree).

    `is_folder` distinguishes the two: folders are pure DB rows (no disk
    object), files carry `url`/`storage_path`/`ext`/`mime`/`size_bytes`.
    `parent_id` is NULL at the resource root and otherwise points at the
    enclosing folder (also a `MaterialFile`). `sort_order` is 0..n within a
    `(resource_id, parent_id)` sibling scope.

    Name uniqueness within a `(resource_id, parent_id)` scope is enforced in
    the service layer via `SELECT WHERE deleted=False` (NOT a DB
    UniqueConstraint — SQLite treats NULL parent_id rows as mutually
    distinct, which would miss root-level dup detection).
    """

    __tablename__ = "material_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("material_resources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Self FK — root-level nodes have NULL parent_id. Deleting a folder row
    # cascades to its descendants at the DB level.
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("material_files.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_folder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Lowercased extension (no dot) — drives icon + preview routing. NULL/""
    # for folders.
    ext: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Absolute URL: `${public_base_url}/uploads/materials/<sid>/<rid>/<file>`.
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Relative on-disk path (physical delete / locate). NULL for folders.
    storage_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    resource: Mapped[MaterialResource] = relationship(
        back_populates="files", lazy="raise"
    )
    # Self-referential tree. remote_side ties `parent` to the row whose `id`
    # equals this row's `parent_id`. passive_deletes=True + DB CASCADE drives
    # subtree deletion; lazy='raise' forbids implicit traversal (the service
    # builds the tree from a flat SELECT, never via .children/.parent).
    parent: Mapped[MaterialFile | None] = relationship(
        back_populates="children",
        remote_side=[id],
        lazy="raise",
    )
    children: Mapped[list[MaterialFile]] = relationship(
        back_populates="parent",
        lazy="raise",
        passive_deletes=True,
    )
