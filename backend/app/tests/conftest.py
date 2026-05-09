"""Pytest fixtures — sqlite test DB + AsyncClient against ASGI app.

Each test session gets a fresh tables-from-metadata sqlite DB so we don't
need a Postgres for unit tests; integration tests against real Postgres
are out of scope for now.
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator

# Force test-time DB before any app import resolves settings.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("DEEPSEEK_DRY_RUN", "1")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db import models  # noqa: F401 - register models
from app.deps import get_db
from app.main import app


@pytest_asyncio.fixture
async def db_engine():
    # StaticPool + check_same_thread=False keeps a single connection so the
    # in-memory sqlite DB is shared between the `db_session` fixture (used
    # for seeding) and the `client` fixture (used for HTTP calls).
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    return async_sessionmaker(bind=db_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def demo_user(db_session: AsyncSession) -> models.User:
    """Insert a single User row matching the BACKEND_SPEC demo account."""
    from app.services.auth import hash_password

    user = models.User(
        id="usr_test_zilun",
        sid="20211010001",
        name="Zilun Wei",
        password_hash=hash_password("123456"),
        bio="测试账号",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
