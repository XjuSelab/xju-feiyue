"""add material_notice (materials-page acknowledgment bar)

Creates the singleton `material_notice` table backing the Notion-style credits
bar on the `/materials` list page, and seeds the one row with a default
acknowledgment (contributed-resource repo + 黄耀增学长) so the bar shows
immediately after deploy. Admins can edit the content or hide it at runtime
(visible=False); the row is kept on hide so it can be restored.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_material_notice"
down_revision: str | None = "0008_user_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DEFAULT_CONTENT = (
    "📚 本页部分课程资料整理自开源仓库 "
    "https://github.com/XJU-OpenHub/XjuCsMajorResources ，"
    "由黄耀增学长贡献，特此致谢 🙏"
)


def upgrade() -> None:
    op.create_table(
        "material_notice",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("visible", sa.Boolean(), nullable=False),
        sa.Column("updated_by_sid", sa.String(11), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # Seed the singleton row (visible by default). Parameter-bound for safety.
    op.execute(
        sa.text(
            "INSERT INTO material_notice (id, content, visible) "
            "VALUES (:id, :content, :visible)"
        ).bindparams(id="default", content=_DEFAULT_CONTENT, visible=True)
    )


def downgrade() -> None:
    op.drop_table("material_notice")
