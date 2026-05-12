"""Likes route tests — idempotent toggle + likedByMe propagation."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Like, Note, User
from app.services.auth import hash_password


async def _seed_note(db_session: AsyncSession, owner_sid: str = "20211010001") -> str:
    """Insert a single Note owned by `owner_sid` and return its id."""
    note = Note(
        id="note_like_target",
        title="Target",
        summary="s",
        content="body",
        category="research",
        tags=[],
        author_sid=owner_sid,
        created_at=datetime.now(timezone.utc),
        read_minutes=1,
    )
    db_session.add(note)
    await db_session.commit()
    return note.id


async def test_like_unauthenticated_returns_401(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    note_id = await _seed_note(db_session)
    r = await client.post(f"/notes/{note_id}/like")
    assert r.status_code == 401


async def test_like_missing_note_returns_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post("/notes/does-not-exist/like", headers=auth_headers)
    assert r.status_code == 404


async def test_like_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)
    r1 = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    r2 = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    assert r1.status_code == 204
    assert r2.status_code == 204

    rows = (
        await db_session.execute(select(Like).where(Like.note_id == note_id))
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_sid == demo_user.sid


async def test_unlike_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)
    # delete with no row exists → still 204
    r = await client.delete(f"/notes/{note_id}/like", headers=auth_headers)
    assert r.status_code == 204

    # like → delete → delete again
    await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    r1 = await client.delete(f"/notes/{note_id}/like", headers=auth_headers)
    r2 = await client.delete(f"/notes/{note_id}/like", headers=auth_headers)
    assert r1.status_code == 204
    assert r2.status_code == 204

    rows = (
        await db_session.execute(select(Like).where(Like.note_id == note_id))
    ).scalars().all()
    assert rows == []


async def test_get_note_returns_liked_by_me_for_authed_user(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)

    # Anonymous GET → likedByMe False
    anon = await client.get("/notes/get", params={"id": note_id})
    assert anon.status_code == 200
    assert anon.json()["likedByMe"] is False
    assert anon.json()["likes"] == 0

    # Like as authed user → likedByMe True, count 1
    await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    authed = await client.get(
        "/notes/get", params={"id": note_id}, headers=auth_headers
    )
    assert authed.status_code == 200
    body = authed.json()
    assert body["likedByMe"] is True
    assert body["likes"] == 1

    # Same GET without token → likedByMe back to False (count still 1)
    anon2 = await client.get("/notes/get", params={"id": note_id})
    assert anon2.json()["likedByMe"] is False
    assert anon2.json()["likes"] == 1


async def test_list_notes_includes_liked_by_me(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    """User's likes show up correctly in GET /notes list output."""
    # Seed two notes
    for i, nid in enumerate(["note_l_a", "note_l_b"]):
        db_session.add(
            Note(
                id=nid,
                title=f"T{i}",
                summary="s",
                content="x",
                category="research",
                tags=[],
                author_sid=demo_user.sid,
                created_at=datetime.now(timezone.utc),
                read_minutes=1,
            )
        )
    await db_session.commit()
    # Like only one of them
    await client.post("/notes/note_l_a/like", headers=auth_headers)

    r = await client.get("/notes", headers=auth_headers)
    assert r.status_code == 200
    items = {n["id"]: n for n in r.json()["items"]}
    assert items["note_l_a"]["likedByMe"] is True
    assert items["note_l_b"]["likedByMe"] is False
