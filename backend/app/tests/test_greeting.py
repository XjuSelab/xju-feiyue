"""Homepage greeting — familiar-name derivation + the auth-gated endpoint."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services import greeting as greeting_svc
from app.services.greeting import familiar_name


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


async def test_greeting_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/ai/greeting")
    assert r.status_code == 401


async def test_greeting_returns_one_line(
    client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No live key in tests → deterministic local line; weather stubbed so the
    test makes no network call."""

    async def _no_weather() -> None:
        return None

    monkeypatch.setattr(greeting_svc, "_fetch_weather", _no_weather)
    r = await client.get("/ai/greeting", headers=auth_headers)
    assert r.status_code == 200, r.text
    text = r.json()["text"]
    assert isinstance(text, str) and text and "\n" not in text
