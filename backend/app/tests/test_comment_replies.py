"""Reply / comment-reaction tests."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Comment, CommentReaction, Note, User
from app.services.auth import hash_password


async def _seed_note(
    db_session: AsyncSession,
    owner_sid: str,
    note_id: str = "note_reply_target",
) -> str:
    note = Note(
        id=note_id,
        title="T",
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


async def _seed_user(
    db_session: AsyncSession,
    sid: str,
    nickname: str,
) -> User:
    user = User(
        sid=sid,
        name=nickname,
        nickname=nickname,
        password_hash=hash_password("123456"),
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _login(client: AsyncClient, sid: str, password: str = "123456") -> dict[str, str]:
    r = await client.post("/auth/login", json={"sid": sid, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_create_reply_round_trip(
    client: AsyncClient,
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    other = await _seed_user(db_session, "20211099008", "other")
    other_headers = await _login(client, other.sid)
    note_id = await _seed_note(db_session, demo_user.sid)

    top = await client.post(
        f"/notes/{note_id}/comments",
        headers=other_headers,
        json={"content": "top level"},
    )
    assert top.status_code == 201
    top_id = top.json()["id"]

    reply = await client.post(
        f"/notes/{note_id}/comments",
        headers=other_headers,
        json={"content": "reply body", "parentId": top_id},
    )
    assert reply.status_code == 201, reply.text
    body = reply.json()
    assert body["parentId"] == top_id
    assert body["replyToSid"] == other.sid
    assert body["images"] == []

    stored = await db_session.get(Comment, body["id"])
    assert stored is not None
    assert stored.parent_id == top_id


async def test_reject_third_level_reply(
    client: AsyncClient,
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid)

    top = await client.post(
        f"/notes/{note_id}/comments",
        headers={"Authorization": f"Bearer {(await client.post('/auth/login', json={'sid': demo_user.sid, 'password': '123456'})).json()['token']}"},
        json={"content": "top"},
    )
    assert top.status_code == 201
    top_id = top.json()["id"]

    second = await client.post(
        f"/notes/{note_id}/comments",
        headers={"Authorization": f"Bearer {(await client.post('/auth/login', json={'sid': demo_user.sid, 'password': '123456'})).json()['token']}"},
        json={"content": "second", "parentId": top_id},
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    third = await client.post(
        f"/notes/{note_id}/comments",
        headers={"Authorization": f"Bearer {(await client.post('/auth/login', json={'sid': demo_user.sid, 'password': '123456'})).json()['token']}"},
        json={"content": "third", "parentId": second_id},
    )
    assert third.status_code == 422


async def test_comment_like_then_dislike_switches_kind(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid)
    created = await client.post(
        f"/notes/{note_id}/comments",
        headers=auth_headers,
        json={"content": "hello"},
    )
    assert created.status_code == 201
    comment_id = created.json()["id"]

    r1 = await client.post(f"/comments/{comment_id}/like", headers=auth_headers)
    r2 = await client.post(f"/comments/{comment_id}/dislike", headers=auth_headers)
    assert r1.status_code == 204
    assert r2.status_code == 204

    rows = (
        await db_session.execute(
            select(CommentReaction).where(CommentReaction.comment_id == comment_id)
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].kind == "dislike"