"""add users.avatar_thumb

Server-generated thumbnail (160 px max edge) for the user's avatar.
Cards / lists render this instead of forcing browsers to downsample
the full-resolution upload into a 20 px chip. Backfill of existing
rows is a one-shot CLI: scripts/backfill_avatar_thumbs.py.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_avatar_thumb"
down_revision: str | None = "0001_init"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("avatar_thumb", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_thumb")
