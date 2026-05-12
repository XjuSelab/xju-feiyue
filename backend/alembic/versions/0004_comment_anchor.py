"""add anchor fields to comments

Anchor a comment to a specific span of the note's rendered body so the
comment can be displayed as an inline quote (and, in a follow-up round,
highlighted in the source). Offsets refer to the rendered DOM
textContent stream — see comments feature MVP plan for details.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_comment_anchor"
down_revision: str | None = "0003_login_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("comments") as batch:
        batch.add_column(sa.Column("anchor_text", sa.Text(), nullable=True))
        batch.add_column(
            sa.Column("anchor_offset_start", sa.Integer(), nullable=True)
        )
        batch.add_column(
            sa.Column("anchor_offset_end", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("comments") as batch:
        batch.drop_column("anchor_offset_end")
        batch.drop_column("anchor_offset_start")
        batch.drop_column("anchor_text")
