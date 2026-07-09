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
os.environ.setdefault("AUTHOR_SYNC_ENABLED", "0")
# Off by default so existing multi-op suites don't trip the limiter; the
# dedicated test_ratelimit.py flips settings.rate_limit_enabled on per-case.
os.environ.setdefault("RATE_LIMIT_ENABLED", "0")
# Off in tests so POST /reports doesn't spawn a background review against the
# shared in-memory DB; test_moderation.py drives review_report/classify directly.
os.environ.setdefault("MODERATION_ENABLED", "0")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db import models  # noqa: F401 - register models
from app.deps import get_db
from app.main import app
from app.ratelimit import limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Isolate the in-process limiter between tests."""
    limiter.reset()
    yield
    limiter.reset()


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
    # autoflush=False mirrors the prod AsyncSessionLocal (db/session.py) — a
    # test-only autoflush=True would mask missing explicit flushes (a SELECT
    # mid-transaction silently flushing parent rows before child INSERTs).
    return async_sessionmaker(bind=db_engine, expire_on_commit=False, autoflush=False)


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
        sid="20211010001",
        name="Zilun Wei",
        nickname="zilun",
        password_hash=hash_password("123456"),
        bio="测试账号",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def authed_token(client: AsyncClient, demo_user: models.User) -> str:
    """POST /auth/login as demo_user and hand back the JWT."""
    r = await client.post(
        "/auth/login", json={"sid": "20211010001", "password": "123456"}
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest_asyncio.fixture
async def auth_headers(authed_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {authed_token}"}


@pytest_asyncio.fixture
def login(client: AsyncClient):
    """Headers factory: login as any seeded sid (password 123456)."""

    async def _login(sid: str) -> dict[str, str]:
        r = await client.post("/auth/login", json={"sid": sid, "password": "123456"})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}"}

    return _login


@pytest_asyncio.fixture
async def demo_class(db_session: AsyncSession) -> models.StudentClass:
    clazz = models.StudentClass(
        full_name="计算机科学与技术24-3", short_name="计算机24-3"
    )
    db_session.add(clazz)
    await db_session.commit()
    await db_session.refresh(clazz)
    return clazz


@pytest_asyncio.fixture
async def class_setup(db_session: AsyncSession, demo_class: models.StudentClass) -> dict:
    """The /class-module cast: a demo class + a second class + edge accounts.

    demo class (计算机24-3): committee (班委甲) + member1/member2 + admin_member
    (site admin who is also a class member — exercises the admin override).
    other class (信安24-2): other_committee (cross-class isolation).
    classless: no class assigned. admin: site admin *without* a class.
    All passwords 123456 (use the `login` fixture).
    """
    from app.services.auth import hash_password

    pwd = hash_password("123456")
    other_class = models.StudentClass(full_name="信息安全24-2", short_name="信安24-2")
    db_session.add(other_class)
    await db_session.flush()

    def mk(sid: str, name: str, class_id: int | None = None, *, committee: bool = False,
           role: str = "user") -> models.User:
        return models.User(
            sid=sid,
            name=name,
            nickname=name,
            password_hash=pwd,
            class_id=class_id,
            is_class_committee=committee,
            role=role,
        )

    users = {
        "committee": mk("20240001001", "班委甲", demo_class.id, committee=True),
        "member1": mk("20240001002", "成员乙", demo_class.id),
        "member2": mk("20240001003", "成员丙", demo_class.id),
        "admin_member": mk("20240001004", "管理同学", demo_class.id, role="admin"),
        "other_committee": mk("20240002001", "外班班委", other_class.id, committee=True),
        "classless": mk("20240003001", "无班级"),
        "admin": mk("20240009001", "管理员", role="admin"),
    }
    for u in users.values():
        db_session.add(u)
    await db_session.commit()
    return {"demo_class": demo_class, "other_class": other_class, **users}


@pytest_asyncio.fixture
async def seeded_notes(db_session: AsyncSession) -> dict:
    """5 notes across 3 categories with varied likes/comments for sort tests.

    Layout (newer → older):
      note_005  tools    1d ago  1 like   1 comment   tag-a
      note_004  kaggle   2d ago  3 likes  2 comments  tag-c
      note_003  research 3d ago  2 likes  0 comments  tag-a tag-b   (q='kaggle' hit)
      note_002  kaggle   4d ago  1 like   1 comment   tag-b
      note_001  research 5d ago  0 likes  0 comments  tag-a
    """
    from datetime import datetime, timedelta, timezone

    from app.services.auth import hash_password

    pwd = hash_password("123456")
    users = []
    for i in range(4):
        u = models.User(
            sid=f"2021101000{i + 1}",
            name=f"User {i}",
            nickname=f"user_{i}",
            password_hash=pwd,
        )
        db_session.add(u)
        users.append(u)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    spec = [
        # (id, category, days_ago, n_likes, n_comments, title, summary, tags)
        ("note_001", "research", 5, 0, 0, "Research A", "summary A", ["tag-a"]),
        ("note_002", "kaggle", 4, 1, 1, "Kaggle B", "summary B", ["tag-b"]),
        ("note_003", "research", 3, 2, 0, "Research C", "Kaggle in summary C", ["tag-a", "tag-b"]),
        ("note_004", "kaggle", 2, 3, 2, "Kaggle D", "summary D", ["tag-c"]),
        ("note_005", "tools", 1, 1, 1, "Tools E", "summary E", ["tag-a"]),
    ]
    for nid, cat, days, _l, _c, title, summary, tags in spec:
        db_session.add(
            models.Note(
                id=nid,
                title=title,
                summary=summary,
                content="",
                category=cat,
                tags=tags,
                author_sid=users[0].sid,
                created_at=now - timedelta(days=days),
                read_minutes=5,
            )
        )
    await db_session.flush()

    for nid, _cat, _days, n_likes, n_comments, *_rest in spec:
        for j in range(n_likes):
            db_session.add(models.Like(note_id=nid, user_sid=users[j].sid))
        for j in range(n_comments):
            db_session.add(
                models.Comment(
                    id=f"cmt_{nid}_{j}",
                    note_id=nid,
                    author_sid=users[j].sid,
                    content=f"comment {j}",
                )
            )
    await db_session.commit()

    return {
        "users": users,
        "note_ids": [s[0] for s in spec],
    }
