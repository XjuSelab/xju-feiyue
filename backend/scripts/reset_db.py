"""Drop + recreate all tables from the current SQLAlchemy metadata.

Use this for local dev resets only — production uses alembic migrations.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import models  # noqa: E402,F401 - register models
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("reset done")


if __name__ == "__main__":
    asyncio.run(main())
