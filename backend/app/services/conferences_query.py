"""Query layer for the conferences domain — full table dump, no filtering."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_LIST_SQL = text(
    """
    SELECT id, abbr, name_full, field, tier, publisher, dblp,
           homepage, cycle, location, conf_date, deadline, note,
           submissions, accepted, acceptance_rate, stats_year
    FROM conferences
    ORDER BY rowid
    """
)


async def list_conferences(session: AsyncSession) -> list[dict[str, Any]]:
    rows = (await session.execute(_LIST_SQL)).mappings().all()
    return [dict(r) for r in rows]
