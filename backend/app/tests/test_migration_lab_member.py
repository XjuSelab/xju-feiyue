from __future__ import annotations

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def _migration_module():
    path = (
        Path(__file__).resolve().parents[2]
        / "alembic"
        / "versions"
        / "0014_lab_member.py"
    )
    spec = importlib.util.spec_from_file_location("migration_0014_lab_member", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_lab_member_migration_adds_non_null_false_default() -> None:
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE users (sid VARCHAR(11) PRIMARY KEY, name VARCHAR(120) NOT NULL)"
            )
        )
        connection.execute(
            sa.text("INSERT INTO users (sid, name) VALUES ('20211010001', 'Alice')")
        )

        module = _migration_module()
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()

        columns = {column["name"]: column for column in sa.inspect(connection).get_columns("users")}
        assert columns["is_lab_member"]["nullable"] is False
        assert str(columns["is_lab_member"]["default"]).strip("()'") == "0"
        assert connection.execute(
            sa.text("SELECT is_lab_member FROM users WHERE sid = '20211010001'")
        ).scalar_one() == 0

        module.downgrade()
        names = {column["name"] for column in sa.inspect(connection).get_columns("users")}
        assert "is_lab_member" not in names
