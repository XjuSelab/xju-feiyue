"""Extra note-interaction tests — dislike/favorite + like/dislike mutual exclusion."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Favorite, Like, Note, NoteDislike, User


async def _seed_note(db_session: AsyncSession, owner_sid: str = "20211010001") -> str:
    note = Note(
        id="note_reaction_target",
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


async def test_like_then_dislike_is_mutually_exclusive(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)

    r1 = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    r2 = await client.post(f"/notes/{note_id}/dislike", headers=auth_headers)

    assert r1.status_code == 204
    assert r2.status_code == 204

    likes = (
        await db_session.execute(select(Like).where(Like.note_id == note_id))
    ).scalars().all()
    dislikes = (
        await db_session.execute(select(NoteDislike).where(NoteDislike.note_id == note_id))
    ).scalars().all()

    assert likes == []
    assert len(dislikes) == 1
    assert dislikes[0].user_sid == demo_user.sid


async def test_dislike_then_like_is_mutually_exclusive(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)

    await client.post(f"/notes/{note_id}/dislike", headers=auth_headers)
    r = await client.post(f"/notes/{note_id}/like", headers=auth_headers)
    assert r.status_code == 204

    likes = (
        await db_session.execute(select(Like).where(Like.note_id == note_id))
    ).scalars().all()
    dislikes = (
        await db_session.execute(select(NoteDislike).where(NoteDislike.note_id == note_id))
    ).scalars().all()

    assert len(likes) == 1
    assert likes[0].user_sid == demo_user.sid
    assert dislikes == []


async def test_favorite_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)

    r1 = await client.post(f"/notes/{note_id}/favorite", headers=auth_headers)
    r2 = await client.post(f"/notes/{note_id}/favorite", headers=auth_headers)
    assert r1.status_code == 204
    assert r2.status_code == 204

    rows = (
        await db_session.execute(select(Favorite).where(Favorite.note_id == note_id))
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_sid == demo_user.sid


async def test_unfavorite_is_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session)

    await client.post(f"/notes/{note_id}/favorite", headers=auth_headers)
    r1 = await client.delete(f"/notes/{note_id}/favorite", headers=auth_headers)
    r2 = await client.delete(f"/notes/{note_id}/favorite", headers=auth_headers)

    assert r1.status_code == 204
    assert r2.status_code == 204

    rows = (
        await db_session.execute(select(Favorite).where(Favorite.note_id == note_id))
    ).scalars().all()
    assert rows == []