"""Smoke tests — confirm the ASGI app boots and the contract surface is wired."""
from httpx import AsyncClient


async def test_health(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_openapi_lists_19_contract_routes(client: AsyncClient) -> None:
    r = await client.get("/openapi.json")
    assert r.status_code == 200
    paths = set(r.json()["paths"].keys())

    expected = {
        "/auth/login",
        "/auth/logout",
        "/auth/me",
        "/notes",
        "/notes/hot",
        "/notes/latest",
        "/notes/liked",
        "/notes/get",
        "/notes/drafts",
        "/notes/drafts/{draft_id}",
        "/notes/drafts/{draft_id}/publish",
        "/notes/{note_id}/like",
        "/notes/{note_id}/comments",
        "/notes/{note_id}/comments/{comment_id}",
        "/ai/compose",
        "/health",
    }
    missing = expected - paths
    assert not missing, f"missing routes: {missing}"
