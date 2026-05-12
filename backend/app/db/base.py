"""SQLAlchemy declarative base. Models are defined in app.db.models."""
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# SQLite ships with foreign-key enforcement disabled by default — without this
# pragma, ondelete='CASCADE' on Like.note_id / Comment.note_id is a no-op and
# deleting a Note leaves orphan rows. Registering on the global Engine class
# means every engine (prod + tests) picks up the pragma on each new connection.
# Detect via module path so the listener handles both sync `sqlite3` and the
# `aiosqlite` async wrapper (SQLAlchemy's AsyncAdapt_aiosqlite_connection lives
# under sqlalchemy.dialects.sqlite.aiosqlite).
@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
    if "sqlite" in dbapi_connection.__class__.__module__.lower():
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
