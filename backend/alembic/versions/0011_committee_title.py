"""add users.committee_title — 班委职务名称 (班长 / 团支书 / …)

Display-only companion to `users.is_class_committee` (which remains the
single permission bit). Set/cleared together with the flag by
POST /admin/users/{sid}/committee. Existing 班委 rows get a NULL title —
the frontend falls back to the generic「班委」label.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_committee_title"
down_revision: str | None = "0010_classes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("committee_title", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "committee_title")
