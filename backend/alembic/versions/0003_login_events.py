"""add login_events

Successful-login audit trail. Admin-only via /admin/login-events.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_login_events"
down_revision: str | None = "0002_avatar_thumb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ip", sa.String(45), nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_login_events_user_sid", "login_events", ["user_sid"])
    op.create_index(
        "ix_login_events_created_at", "login_events", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_login_events_created_at", table_name="login_events")
    op.drop_index("ix_login_events_user_sid", table_name="login_events")
    op.drop_table("login_events")
