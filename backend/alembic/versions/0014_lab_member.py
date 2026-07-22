"""add users.is_lab_member for ICTHub access control

ICTHub reuses Feiyue accounts and JWT authentication.  This boolean remains
owned and administered by Feiyue; ICTHub only consumes the `isLabMember`
claim returned by `/auth/me`.

Use a plain ADD COLUMN on SQLite.  Rebuilding `users` is unsafe because many
content tables reference it with ON DELETE CASCADE (see 0010_classes.py).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_lab_member"
down_revision: str | None = "0013_drop_growth_checkin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_lab_member",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "is_lab_member")
