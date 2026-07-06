"""Check-in / xp route tests."""
from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CheckIn, User, XpEvent


async def test_checkin_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    r1 = await client.post("/auth/me/checkin", headers=auth_headers)
    r2 = await client.post("/auth/me/checkin", headers=auth_headers)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text

    body1 = r1.json()
    body2 = r2.json()

    assert body1["gainedExp"] == 5
    assert body1["alreadyCheckedIn"] is False
    assert body2["gainedExp"] == 0
    assert body2["alreadyCheckedIn"] is True

    user = await db_session.get(User, demo_user.sid)
    assert user is not None
    assert user.exp == 5
    assert user.level == 0

    checkins = (
        await db_session.execute(select(CheckIn).where(CheckIn.user_sid == demo_user.sid))
    ).scalars().all()
    xp_events = (
        await db_session.execute(select(XpEvent).where(XpEvent.user_sid == demo_user.sid))
    ).scalars().all()

    assert len(checkins) == 1
    assert len(xp_events) == 1
    assert xp_events[0].source_type == "daily_checkin"
    assert xp_events[0].delta == 5


async def test_list_xp_events_returns_checkin_event(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    checked = await client.post("/auth/me/checkin", headers=auth_headers)
    assert checked.status_code == 200

    events = await client.get("/auth/me/xp-events", headers=auth_headers)
    assert events.status_code == 200, events.text
    body = events.json()
    assert len(body) >= 1
    assert body[0]["sourceType"] == "daily_checkin"
    assert body[0]["delta"] == 5