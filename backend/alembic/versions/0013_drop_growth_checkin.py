"""drop 签到领经验 (growth) — check_ins / xp_events / users.exp / users.level

产品决定移除每日签到与经验等级体系（签到是唯一的经验来源，皮之不存）。
上线时生产两表均为 0 行、exp/level 全 0，无数据损失。

users 列用纯 DROP COLUMN（SQLite ≥3.35 原生支持）——绝不能 batch_alter_table
重建 users：内容表全部 ON DELETE CASCADE 指向 users.sid，表重建会级联清空
（见 0010_classes 的教训注释）。
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_drop_growth_checkin"
down_revision: str | None = "0010_community_growth_collections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_xp_events_created_at", table_name="xp_events")
    op.drop_index("ix_xp_events_user_sid", table_name="xp_events")
    op.drop_table("xp_events")
    op.drop_table("check_ins")
    op.drop_column("users", "level")
    op.drop_column("users", "exp")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("exp", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
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
