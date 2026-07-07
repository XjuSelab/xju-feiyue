"""Block query helpers — one-directional, silent user blocks."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Block


async def blocked_sids(db: AsyncSession, blocker_sid: str | None) -> set[str]:
    """The set of SIDs `blocker_sid` has blocked (empty for anon / no blocks)."""
    if not blocker_sid:
        return set()
    rows = await db.execute(select(Block.blocked_sid).where(Block.blocker_sid == blocker_sid))
    return {row[0] for row in rows.all()}
