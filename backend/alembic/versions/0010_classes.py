"""add class-management tables — classes / roll-call / groups / group space

Backs the new `/class` 班级空间 module:

  - `classes`: normalized 班级 rows (full_name 计算机科学与技术24-3 /
    short_name 计算机24-3). The product spec's "two class-name columns on
    users" is honored on the wire (UserOut.classFullName/classShortName)
    while storage anchors roll-call/groups to a stable FK.
  - `users.class_id` (FK, ondelete SET NULL) + `users.is_class_committee`
    (班委 flag, server_default 0 for the 108 existing rows).
  - `roll_call_sessions` / `roll_call_records`: 点名 sessions snapshot the
    roster at creation; records are (session_id, sid) composite-PK rows.
  - `groups` / `group_members` / `group_join_requests`: 小组 with logo,
    leader (组长), soft-delete, and the 申请加入 flow.
  - `group_files` (flat list, uploads/groups/<gid>/) / `group_tasks` +
    `group_task_assignees` (Gantt task assignment).

users columns are added via batch_alter_table so the new FK is SQLite-safe.
No data backfill — class assignment happens via scripts/add_user.py
--class-full/--class-short or the /admin UI.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010_classes"
down_revision: str | None = "0009_material_notice"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "classes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(120), nullable=False, unique=True),
        sa.Column("short_name", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("class_id", sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column(
                "is_class_committee",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch.create_foreign_key(
            "fk_users_class_id_classes",
            "classes",
            ["class_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index("ix_users_class_id", "users", ["class_id"])

    op.create_table(
        "roll_call_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(120), nullable=True),
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
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_roll_call_sessions_class_id", "roll_call_sessions", ["class_id"])
    op.create_index("ix_roll_call_sessions_created_at", "roll_call_sessions", ["created_at"])

    op.create_table(
        "roll_call_records",
        sa.Column(
            "session_id",
            sa.String(64),
            sa.ForeignKey("roll_call_sessions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("present", sa.Boolean(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_by_sid", sa.String(11), nullable=True),
    )

    op.create_table(
        "groups",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("logo", sa.String(512), nullable=True),
        sa.Column("logo_thumb", sa.String(512), nullable=True),
        sa.Column("intro", sa.Text(), nullable=False),
        sa.Column(
            "leader_sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("deleted", sa.Boolean(), nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_groups_class_id", "groups", ["class_id"])
    op.create_index("ix_groups_deleted", "groups", ["deleted"])

    op.create_table(
        "group_members",
        sa.Column(
            "group_id",
            sa.String(64),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_group_members_sid", "group_members", ["sid"])

    op.create_table(
        "group_join_requests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "group_id",
            sa.String(64),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("decided_by_sid", sa.String(11), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_group_join_requests_group_id", "group_join_requests", ["group_id"])
    op.create_index("ix_group_join_requests_sid", "group_join_requests", ["sid"])

    op.create_table(
        "group_files",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "group_id",
            sa.String(64),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("ext", sa.String(32), nullable=True),
        sa.Column("mime", sa.String(128), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(512), nullable=True),
        sa.Column("storage_path", sa.String(512), nullable=True),
        sa.Column(
            "uploaded_by_sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_group_files_group_id", "group_files", ["group_id"])
    op.create_index("ix_group_files_deleted", "group_files", ["deleted"])

    op.create_table(
        "group_tasks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "group_id",
            sa.String(64),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_group_tasks_group_id", "group_tasks", ["group_id"])

    op.create_table(
        "group_task_assignees",
        sa.Column(
            "task_id",
            sa.String(64),
            sa.ForeignKey("group_tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "sid",
            sa.String(11),
            sa.ForeignKey("users.sid", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("group_task_assignees")
    op.drop_index("ix_group_tasks_group_id", table_name="group_tasks")
    op.drop_table("group_tasks")
    op.drop_index("ix_group_files_deleted", table_name="group_files")
    op.drop_index("ix_group_files_group_id", table_name="group_files")
    op.drop_table("group_files")
    op.drop_index("ix_group_join_requests_sid", table_name="group_join_requests")
    op.drop_index("ix_group_join_requests_group_id", table_name="group_join_requests")
    op.drop_table("group_join_requests")
    op.drop_index("ix_group_members_sid", table_name="group_members")
    op.drop_table("group_members")
    op.drop_index("ix_groups_deleted", table_name="groups")
    op.drop_index("ix_groups_class_id", table_name="groups")
    op.drop_table("groups")
    op.drop_table("roll_call_records")
    op.drop_index("ix_roll_call_sessions_created_at", table_name="roll_call_sessions")
    op.drop_index("ix_roll_call_sessions_class_id", table_name="roll_call_sessions")
    op.drop_table("roll_call_sessions")
    op.drop_index("ix_users_class_id", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("fk_users_class_id_classes", type_="foreignkey")
        batch.drop_column("is_class_committee")
        batch.drop_column("class_id")
    op.drop_table("classes")
