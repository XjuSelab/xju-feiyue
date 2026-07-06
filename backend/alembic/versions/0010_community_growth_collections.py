"""community/growth/collection expansion

Adds the second-wave community tables and fields:

- users.exp / users.level
- notes.status
- comments.parent_id / reply_to_sid / images / status
- note_dislikes / favorites / comment_reactions
- reports / blocks
- check_ins / xp_events
- collections / collection_entries
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.db.models import StringList

revision: str = "0010_community_growth_collections"
down_revision: str | None = "0009_material_notice"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("exp", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
    )

    op.add_column(
        "notes",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="visible"),
    )
    op.create_index("ix_notes_status", "notes", ["status"])

    op.add_column("comments", sa.Column("parent_id", sa.String(length=64), nullable=True))
    op.add_column("comments", sa.Column("reply_to_sid", sa.String(length=11), nullable=True))
    op.add_column(
        "comments",
        sa.Column("images", StringList(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "comments",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="visible"),
    )
    op.create_foreign_key(
        "fk_comments_parent_id_comments",
        "comments",
        "comments",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_comments_reply_to_sid_users",
        "comments",
        "users",
        ["reply_to_sid"],
        ["sid"],
        ondelete="SET NULL",
    )
    op.create_index("ix_comments_parent_id", "comments", ["parent_id"])
    op.create_index("ix_comments_status", "comments", ["status"])

    op.create_table(
        "note_dislikes",
        sa.Column(
            "note_id",
            sa.String(length=64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "user_sid", name="uq_note_dislikes_note_user"),
    )

    op.create_table(
        "favorites",
        sa.Column(
            "note_id",
            sa.String(length=64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "user_sid", name="uq_favorites_note_user"),
    )

    op.create_table(
        "comment_reactions",
        sa.Column(
            "comment_id",
            sa.String(length=64),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "comment_id", "user_sid", name="uq_comment_reactions_comment_user"
        ),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "reporter_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column(
            "target_note_id",
            sa.String(length=64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "target_comment_id",
            sa.String(length=64),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("target_snapshot", sa.Text(), nullable=False, server_default=""),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("ai_label", sa.String(length=32), nullable=True),
        sa.Column("ai_confidence", sa.Float(), nullable=True),
        sa.Column("ai_reason", sa.Text(), nullable=True),
        sa.Column("resolution_action", sa.String(length=16), nullable=True),
        sa.Column("resolution_comment", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_reports_reporter_sid", "reports", ["reporter_sid"])
    op.create_index("ix_reports_target_note_id", "reports", ["target_note_id"])
    op.create_index("ix_reports_target_comment_id", "reports", ["target_comment_id"])
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])

    op.create_table(
        "blocks",
        sa.Column(
            "blocker_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "blocked_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("blocker_sid", "blocked_sid", name="uq_blocks_blocker_blocked"),
    )

    op.create_table(
        "check_ins",
        sa.Column(
            "user_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("checkin_date", sa.Date(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "xp_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("ref_type", sa.String(length=32), nullable=True),
        sa.Column("ref_id", sa.String(length=64), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_xp_events_user_sid", "xp_events", ["user_sid"])
    op.create_index("ix_xp_events_created_at", "xp_events", ["created_at"])

    op.create_table(
        "collections",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "owner_sid",
            sa.String(length=11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_collections_owner_sid", "collections", ["owner_sid"])

    op.create_table(
        "collection_entries",
        sa.Column(
            "collection_id",
            sa.String(length=64),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "note_id",
            sa.String(length=64),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", name="uq_collection_entries_note_unique"),
    )


def downgrade() -> None:
    op.drop_table("collection_entries")
    op.drop_index("ix_collections_owner_sid", table_name="collections")
    op.drop_table("collections")
    op.drop_index("ix_xp_events_created_at", table_name="xp_events")
    op.drop_index("ix_xp_events_user_sid", table_name="xp_events")
    op.drop_table("xp_events")
    op.drop_table("check_ins")
    op.drop_table("blocks")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_target_comment_id", table_name="reports")
    op.drop_index("ix_reports_target_note_id", table_name="reports")
    op.drop_index("ix_reports_reporter_sid", table_name="reports")
    op.drop_table("reports")
    op.drop_table("comment_reactions")
    op.drop_table("favorites")
    op.drop_table("note_dislikes")
    op.drop_index("ix_comments_status", table_name="comments")
    op.drop_index("ix_comments_parent_id", table_name="comments")
    op.drop_constraint("fk_comments_reply_to_sid_users", "comments", type_="foreignkey")
    op.drop_constraint("fk_comments_parent_id_comments", "comments", type_="foreignkey")
    op.drop_column("comments", "status")
    op.drop_column("comments", "images")
    op.drop_column("comments", "reply_to_sid")
    op.drop_column("comments", "parent_id")
    op.drop_index("ix_notes_status", table_name="notes")
    op.drop_column("notes", "status")
    op.drop_column("users", "level")
    op.drop_column("users", "exp")