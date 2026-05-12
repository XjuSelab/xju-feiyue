"""add summary column to drafts

Lets users (or the AI summarize mode) author the card-summary before
publishing, instead of relying solely on `summary_from(content)` at
publish time.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_draft_summary"
down_revision: str | None = "0004_comment_anchor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("drafts") as batch:
        batch.add_column(
            sa.Column(
                "summary",
                sa.Text(),
                nullable=False,
                server_default="",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("drafts") as batch:
        batch.drop_column("summary")
