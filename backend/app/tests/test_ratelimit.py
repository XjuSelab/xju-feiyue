"""Rate limiting — sliding-window unit tests + endpoint integration tests."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import ratelimit
from app.db.models import Note, User
from app.ratelimit import SlidingWindowLimiter
from app.settings import settings


# --- unit: the algorithm --------------------------------------------------
def test_sliding_window_allows_up_to_limit_then_blocks():
    lim = SlidingWindowLimiter()
    key = "interaction:u1"
    for i in range(3):
        allowed, retry = lim.check(key, limit=3, window=10.0, now=100.0 + i)
        assert allowed is True
        assert retry == 0.0
    allowed, retry = lim.check(key, limit=3, window=10.0, now=103.0)
    assert allowed is False
    # oldest accepted hit at t=100, window 10 -> frees at 110; now=103 -> ~7s
    assert 6.9 <= retry <= 7.1


def test_sliding_window_recovers_after_window():
    lim = SlidingWindowLimiter()
    key = "interaction:u1"
    for i in range(3):
        lim.check(key, 3, 10.0, now=100.0 + i)  # hits at 100, 101, 102
    # at t=111 the hits at 100 and 101 have aged out (<= 111 - 10)
    allowed, _ = lim.check(key, 3, 10.0, now=111.0)
    assert allowed is True


def test_rejected_hit_does_not_extend_window():
    lim = SlidingWindowLimiter()
    key = "interaction:u1"
    for i in range(2):
        lim.check(key, 2, 10.0, now=100.0 + i)  # fill to limit
    # repeated rejections while spamming must not push the reset time out
    for t in (100.5, 101.0, 101.5):
        allowed, retry = lim.check(key, 2, 10.0, now=t)
        assert allowed is False
    allowed, _ = lim.check(key, 2, 10.0, now=110.1)  # first hit (t=100) expired
    assert allowed is True


# --- integration: the FastAPI dependency ----------------------------------
async def _seed_note(db_session: AsyncSession, owner_sid: str, nid: str = "rl_note") -> str:
    note = Note(
        id=nid,
        title="t",
        summary="s",
        content="b",
        category="research",
        tags=[],
        author_sid=owner_sid,
        created_at=datetime.now(timezone.utc),
        read_minutes=1,
    )
    db_session.add(note)
    await db_session.commit()
    return note.id


async def test_interaction_endpoint_throttled_when_enabled(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
    monkeypatch,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid)
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setitem(ratelimit.LIMITS, "interaction", (3, 60.0))

    for _ in range(3):
        r = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
        assert r.status_code == 204

    blocked = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


async def test_report_endpoint_throttled_when_enabled(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
    monkeypatch,
) -> None:
    """POST /reports 走 'report' 桶 —— 每单触发后台 AI 预审，必须挡刷单。"""
    note_id = await _seed_note(db_session, demo_user.sid, nid="rl_note3")
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setitem(ratelimit.LIMITS, "report", (2, 60.0))

    body = {"targetType": "note", "targetId": note_id, "reason": "spam"}
    for _ in range(2):
        r = await client.post("/reports", headers=auth_headers, json=body)
        assert r.status_code == 201, r.text

    blocked = await client.post("/reports", headers=auth_headers, json=body)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


async def test_not_throttled_when_disabled(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
    monkeypatch,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid, nid="rl_note2")
    # rate_limit_enabled stays False (test default); a tight limit is ignored.
    monkeypatch.setitem(ratelimit.LIMITS, "interaction", (2, 60.0))
    for _ in range(5):
        r = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
        assert r.status_code == 204


async def test_unauthenticated_is_401_not_429(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    r = await client.post("/notes/whatever/like")
    assert r.status_code == 401
