"""init schema — users / notes / drafts / likes / comments

Revision ID: 0001_init
Revises:
Create Date: 2026-05-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.models import StringList

revision: str = "0001_init"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("sid", sa.String(11), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("avatar", sa.String(512), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("sid", name="uq_users_sid"),
    )
    op.create_index("ix_users_sid", "users", ["sid"])

    op.create_table(
        "notes",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover", sa.String(512), nullable=True),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("tags", StringList(), nullable=False),
        sa.Column(
            "author_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("read_minutes", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_notes_category", "notes", ["category"])
    op.create_index("ix_notes_created_at", "notes", ["created_at"])

    op.create_table(
        "drafts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "owner_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(20), nullable=True),
        sa.Column("tags", StringList(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_drafts_owner_id", "drafts", ["owner_id"])
    op.create_index("ix_drafts_updated_at", "drafts", ["updated_at"])

    op.create_table(
        "likes",
        sa.Column(
            "note_id",
            sa.String(64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "user_id", name="uq_likes_note_user"),
    )

    op.create_table(
        "comments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "note_id",
            sa.String(64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_comments_note_id", "comments", ["note_id"])
    op.create_index("ix_comments_created_at", "comments", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_comments_created_at", table_name="comments")
    op.drop_index("ix_comments_note_id", table_name="comments")
    op.drop_table("comments")
    op.drop_table("likes")
    op.drop_index("ix_drafts_updated_at", table_name="drafts")
    op.drop_index("ix_drafts_owner_id", table_name="drafts")
    op.drop_table("drafts")
    op.drop_index("ix_notes_created_at", table_name="notes")
    op.drop_index("ix_notes_category", table_name="notes")
    op.drop_table("notes")
    op.drop_index("ix_users_sid", table_name="users")
    op.drop_table("users")
