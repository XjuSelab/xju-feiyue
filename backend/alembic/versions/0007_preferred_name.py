"""add users.preferred_name

Greeting form-of-address for the homepage welcome line. Derived from the
user's legal name at registration (interpunct → first segment / ≤2 chars →
whole name / ≥3 chars → trailing two chars), or user-customized via
PATCH /auth/me. Nullable: legacy rows stay NULL and are derived at runtime
via greeting.familiar_name(name), so no data backfill is required.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_preferred_name"
down_revision: str | None = "0006_materials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_name", sa.String(120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_name")
