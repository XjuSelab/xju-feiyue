"""add class_missions — 分组任务 (grouping mission) at the top of /class

A class runs one *active* 分组任务 at a time (学委「设为进行中」); over a term it
may have several in sequence. Missions are class-scoped labels — groups are NOT
partitioned per mission yet, so the active mission only re-frames the /class UI
(three-layer navigation), it doesn't re-shuffle groups. At most one row per class
has is_active=True (service-enforced, like roll-call's single active writer).

Plain create_table — no users/table rebuild, so the FK-cascade hazard documented
in 0010_classes.py doesn't apply here.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_class_missions"
down_revision: str | None = "0011_committee_title"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "class_missions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
            index=True,
        ),
        sa.Column(
            "created_by_sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
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


def downgrade() -> None:
    op.drop_table("class_missions")
