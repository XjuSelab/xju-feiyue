"""Read-only AsyncEngine for the CCF conferences data domain.

Mirror of ``schools_engine.py``: conferences.sqlite is produced by
``scripts/seed_conferences.py`` (R0) and the R3 crawler, synced via
the ``conferences/`` HF namespace. Opens ``mode=ro&immutable=1``,
hot-reloads on mtime, caches manifest.json, missing file = 503.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

_log = logging.getLogger("xju_feiyue.conferences_engine")


class ConferencesDataMissing(RuntimeError):
    pass


class ConferencesEngineHolder:
    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._sqlite_path = data_dir / "conferences.sqlite"
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
    def is_ready(self) -> bool:
        return self._engine is not None

    async def boot(self) -> None:
        try:
            await self._maybe_reload()
        except Exception:  # noqa: BLE001
            _log.exception("conferences_engine: initial boot failed")

    async def get_engine(self) -> AsyncEngine:
        await self._maybe_reload()
        if self._engine is None:
            raise ConferencesDataMissing(
                f"conferences.sqlite not found under {self._data_dir}"
            )
        return self._engine

    async def force_reload(self) -> bool:
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

    async def _maybe_reload(self) -> None:
        if not self._sqlite_path.exists():
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
        _log.info("conferences_engine: loaded %s (mtime=%s)", self._sqlite_path, self._mtime)

    def _build_engine(self) -> AsyncEngine:
        abs_path = self._sqlite_path.resolve()
        url = f"sqlite+aiosqlite:///file:{abs_path}?mode=ro&immutable=1&uri=true"
        eng = create_async_engine(url, future=True, echo=False, connect_args={"uri": True})

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
            _log.exception("conferences_engine: manifest parse failed")
            return None


_holder: ConferencesEngineHolder | None = None


def init_holder(data_dir: Path) -> ConferencesEngineHolder:
    global _holder
    _holder = ConferencesEngineHolder(data_dir)
    return _holder


def get_holder() -> ConferencesEngineHolder:
    if _holder is None:
        raise RuntimeError("conferences engine holder not initialised")
    return _holder
