"""Read-only AsyncEngine for the schools data domain.

The schools.sqlite file is produced out-of-band by supervisor-claw and
synced into ``settings.schools_data_dir`` (see
``docs/plan-schools-integration.md`` §6). This module owns a single
``SchoolsEngineHolder`` that:

* opens the SQLite file in URI ``mode=ro&immutable=1`` so we can never
  accidentally write, and so SQLite skips WAL/-shm bookkeeping (no
  ``schools.sqlite-wal`` next to the file);
* re-builds the engine when the file's mtime changes (claw re-syncs land
  via atomic rename → mtime bumps → next request sees the new bytes);
* caches the sibling ``manifest.json`` so ``/schools/meta`` can advertise
  schema_version, exported_at, etc., without re-reading on every hit.

Missing file is treated as "data not ready": ``get_engine()`` raises
``SchoolsDataMissing`` and the routes layer translates that to a 503 so
the rest of the API keeps working.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

_log = logging.getLogger("xju_feiyue.schools_engine")


class SchoolsDataMissing(RuntimeError):
    """Raised when schools.sqlite is not present on disk."""


class SchoolsEngineHolder:
    """Singleton wrapper around one read-only AsyncEngine."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._sqlite_path = data_dir / "schools.sqlite"
        self._manifest_path = data_dir / "manifest.json"
        self._engine: AsyncEngine | None = None
        self._mtime: float = 0.0
        self._manifest: dict[str, Any] | None = None
        self._lock = asyncio.Lock()

    @property
    def sqlite_path(self) -> Path:
        return self._sqlite_path

    @property
    def manifest(self) -> dict[str, Any] | None:
        return self._manifest

    @property
    def mtime(self) -> float:
        """Current sqlite mtime — used as a cache key for derived indexes."""
        return self._mtime

    @property
    def is_ready(self) -> bool:
        return self._engine is not None

    async def boot(self) -> None:
        """Try once at startup; never raise (missing file is fine)."""
        try:
            await self._maybe_reload()
        except Exception:  # noqa: BLE001 — boot must not fail the app
            _log.exception("schools_engine: initial boot failed")

    async def get_engine(self) -> AsyncEngine:
        """Return the live engine, reloading if the file changed."""
        await self._maybe_reload()
        if self._engine is None:
            raise SchoolsDataMissing(
                f"schools.sqlite not found under {self._data_dir}"
            )
        return self._engine

    async def force_reload(self) -> bool:
        """Drop cached state and re-stat (used by /admin/schools/reload).

        Returns True if an engine is live after reload.
        """
        async with self._lock:
            old = self._engine
            self._engine = None
            self._mtime = 0.0
            self._manifest = None
            try:
                await self._reload_locked()
            finally:
                if old is not None and old is not self._engine:
                    await old.dispose()
        return self._engine is not None

    async def dispose(self) -> None:
        async with self._lock:
            if self._engine is not None:
                await self._engine.dispose()
                self._engine = None

    # internals -----------------------------------------------------------

    async def _maybe_reload(self) -> None:
        if not self._sqlite_path.exists():
            # File disappeared — drop the engine.
            if self._engine is not None:
                async with self._lock:
                    if self._engine is not None:
                        await self._engine.dispose()
                        self._engine = None
                        self._mtime = 0.0
                        self._manifest = None
            return
        mt = self._sqlite_path.stat().st_mtime
        if mt == self._mtime and self._engine is not None:
            return
        async with self._lock:
            # Re-check under lock (another coroutine may have done it).
            if self._engine is not None and self._sqlite_path.stat().st_mtime == self._mtime:
                return
            await self._reload_locked()

    async def _reload_locked(self) -> None:
        if not self._sqlite_path.exists():
            return
        old = self._engine
        self._engine = self._build_engine()
        self._mtime = self._sqlite_path.stat().st_mtime
        self._manifest = self._load_manifest()
        if old is not None:
            await old.dispose()
        _log.info(
            "schools_engine: loaded %s (mtime=%s, manifest_version=%s)",
            self._sqlite_path,
            self._mtime,
            (self._manifest or {}).get("schema_version"),
        )

    def _build_engine(self) -> AsyncEngine:
        # mode=ro → kernel-level read-only. immutable=1 → SQLite trusts the
        # file is unchanging within this connection's lifetime, skips
        # journaling. Together they guarantee no `-wal`/`-shm` siblings.
        # We re-stat on every request anyway, so "immutable per connection"
        # is fine: each request opens a fresh connection.
        abs_path = self._sqlite_path.resolve()
        url = f"sqlite+aiosqlite:///file:{abs_path}?mode=ro&immutable=1&uri=true"
        eng = create_async_engine(
            url,
            future=True,
            echo=False,
            connect_args={"uri": True},
        )

        # Defence in depth: PRAGMA query_only forces a SQLITE_READONLY error
        # on any UPDATE/DELETE/INSERT, in case an ORM call slips through.
        @event.listens_for(eng.sync_engine, "connect")
        def _query_only(dbapi_conn, _record):  # type: ignore[no-untyped-def]
            cur = dbapi_conn.cursor()
            try:
                cur.execute("PRAGMA query_only = ON")
            finally:
                cur.close()

        return eng

    def _load_manifest(self) -> dict[str, Any] | None:
        if not self._manifest_path.exists():
            return None
        try:
            return json.loads(self._manifest_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            _log.exception("schools_engine: manifest parse failed")
            return None


_holder: SchoolsEngineHolder | None = None


def init_holder(data_dir: Path) -> SchoolsEngineHolder:
    """Wire up the process-wide holder. Call once from app lifespan."""
    global _holder
    _holder = SchoolsEngineHolder(data_dir)
    return _holder


def get_holder() -> SchoolsEngineHolder:
    if _holder is None:
        raise RuntimeError(
            "schools engine holder not initialised — call init_holder() in lifespan"
        )
    return _holder
