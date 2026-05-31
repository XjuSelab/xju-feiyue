"""Homepage greetings — familiar-name derivation, degeneration validation,
per-user caching, and the auth-gated endpoint."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services import greeting as greeting_svc
from app.services.greeting import (
    compose_greetings,
    familiar_name,
    is_valid_greeting,
)


@pytest.fixture(autouse=True)
def _clear_greetings_cache() -> None:
    """Per-sid cache is process-level; clear it so dry-run assertions on the
    generated lines don't get a stale hit from another test."""
    greeting_svc._GREETINGS_CACHE.clear()


@pytest.fixture(autouse=True)
def _stub_weather(monkeypatch: pytest.MonkeyPatch) -> None:
    """No network in tests — weather is always best-effort and may be None."""

    async def _no_weather() -> None:
        return None

    monkeypatch.setattr(greeting_svc, "_fetch_weather", _no_weather)


@pytest.mark.parametrize(
    ("full", "expected"),
    [
        ("林", "林"),  # single char → as-is
        ("陈一", "陈一"),  # two chars → whole name
        ("刘德彬", "德彬"),  # three chars → drop surname, keep last two
        ("欧阳云帆", "云帆"),  # four chars → keep last two
        ("艾力·买买提", "艾力"),  # interpunct → first segment
        ("", "同学"),  # empty → neutral address
        ("   ", "同学"),
    ],
)
def test_familiar_name(full: str, expected: str) -> None:
    assert familiar_name(full) == expected


@pytest.mark.parametrize(
    "bad",
    [
        "",  # empty
        "   ",  # whitespace only
        "。。。",  # pure punctuation
        "，，",  # pure punctuation
        "陈",  # single CJK char
        "云帆",  # == address only
        "云帆，",  # address + trailing punct only
        "云帆！",  # address + trailing punct only
        "云帆" * 30,  # runaway length (> MAX_LEN)
    ],
)
def test_is_valid_greeting_rejects(bad: str) -> None:
    assert is_valid_greeting(bad, "云帆") is False


def test_is_valid_greeting_rejects_newline() -> None:
    assert is_valid_greeting("云帆，早呀\n新的一天开始啦。", "云帆") is False


@pytest.mark.parametrize(
    "good",
    [
        "云帆，早呀，新的一天开始啦。",
        "云帆，下午好，起来走走、喝杯水吧。",
        "云帆，忙到这会儿，记得吃口东西呀。",
    ],
)
def test_is_valid_greeting_accepts(good: str) -> None:
    assert is_valid_greeting(good, "云帆") is True


async def test_greetings_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/ai/greetings")
    assert r.status_code == 401


async def test_greetings_returns_three(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    """Dry-run in tests → three deterministic distinct local lines, no network."""
    r = await client.get("/ai/greetings", headers=auth_headers)
    assert r.status_code == 200, r.text
    greetings = r.json()["greetings"]
    assert isinstance(greetings, list)
    assert len(greetings) == 3
    # demo_user.name == "Zilun Wei" → familiar_name keeps trailing two chars.
    addr = familiar_name("Zilun Wei")
    for g in greetings:
        assert isinstance(g, str) and g
        assert "\n" not in g
        assert g != addr  # never just the address
        assert is_valid_greeting(g, addr)
    assert len(set(greetings)) == 3  # all distinct


async def test_compose_greetings_cached() -> None:
    """Two calls for the same sid (dry-run) hit the per-user cache and are
    byte-identical. preferred_name omitted → address derived from the name."""
    sid = "20211010001"
    first = await compose_greetings(sid, "欧阳云帆", None, n=3)
    second = await compose_greetings(sid, "欧阳云帆", None, n=3)
    assert first == second
    assert len(first) == 3
    # Derived address (trailing two chars) appears in every dry-run line.
    addr = familiar_name("欧阳云帆")
    assert all(addr in g for g in first)


async def test_compose_greetings_preferred_name_overrides() -> None:
    """A set preferred_name is used verbatim as the address, not the derived
    familiar_name."""
    sid = "20211010002"
    nick = "小帆"  # a self-chosen nickname, not anyone's real name
    lines = await compose_greetings(sid, "欧阳云帆", nick, n=3)
    assert len(lines) == 3
    derived = familiar_name("欧阳云帆")
    assert nick != derived
    # Every dry-run line addresses the user by the preferred name, never the
    # derived one.
    assert all(g.startswith(nick) for g in lines)
    assert all(derived not in g for g in lines)
