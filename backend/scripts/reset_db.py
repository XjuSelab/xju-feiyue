"""Drop + recreate all tables from the current SQLAlchemy metadata.

Use this for local dev resets only — production uses alembic migrations.
"""
from __future__ import annotations

import asyncio

from app.db import models  # noqa: F401 - register models
from app.db.base import Base
from app.db.session import engine


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("reset done")


if __name__ == "__main__":
    asyncio.run(main())
