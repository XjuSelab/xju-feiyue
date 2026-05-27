"""Pydantic schemas for /conferences — snake_case wire (SnakeModel)."""
from __future__ import annotations

from typing import Literal

from app.schemas._base import SnakeModel

Tier = Literal["A", "B", "C"]


class ConferenceRow(SnakeModel):
    id: str
    abbr: str
    name_full: str
    field: str
    tier: Tier
    publisher: str
    dblp: str
    homepage: str | None = None
    cycle: str | None = None
    location: str | None = None
    conf_date: str | None = None
    deadline: str | None = None
    note: str | None = None
    submissions: int | None = None
    accepted: int | None = None
    acceptance_rate: float | None = None
    stats_year: int | None = None


class ManifestOut(SnakeModel):
    schema_version: int | None = None
    exported_at: str | None = None
    claw_version: str | None = None
    conferences_sqlite_sha256: str | None = None
    conferences_sqlite_bytes: int | None = None
    counts: dict[str, int] | None = None


class ConferencesOut(SnakeModel):
    conferences: list[ConferenceRow]
    count: int
    manifest: ManifestOut | None = None


class ReloadResult(SnakeModel):
    ok: bool
    manifest: ManifestOut | None = None
