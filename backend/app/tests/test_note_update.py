"""PATCH/DELETE /notes/{id} — ownership + summary recompute + cascade."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Comment, Like, Note, User
from app.services.auth import hash_password


async def _seed_note(
    db_session: AsyncSession, owner_sid: str, note_id: str = "note_owned"
) -> str:
    note = Note(
        id=note_id,
        title="Original",
        summary="orig summary",
        content="orig body",
        category="research",
        tags=["a"],
        author_sid=owner_sid,
        created_at=datetime.now(timezone.utc),
        read_minutes=1,
    )
    db_session.add(note)
    await db_session.commit()
    return note.id


async def test_patch_unauthenticated_returns_401(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.patch(f"/notes/{nid}", json={"title": "x"})
    assert r.status_code == 401


async def test_patch_other_users_note_returns_403(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = User(
        sid="20211099001",
        name="Other",
        nickname="other",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    nid = await _seed_note(db_session, other.sid, "note_other_a")

    r = await client.patch(
        f"/notes/{nid}", headers=auth_headers, json={"title": "hijack"}
    )
    assert r.status_code == 403


async def test_patch_unknown_note_returns_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.patch(
        "/notes/nope", headers=auth_headers, json={"title": "x"}
    )
    assert r.status_code == 404


async def test_patch_only_specified_fields(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_patch_1")
    r = await client.patch(
        f"/notes/{nid}", headers=auth_headers, json={"title": "New title"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "New title"
    assert body["category"] == "research"  # unchanged
    assert body["tags"] == ["a"]  # unchanged
    assert body["content"] == "orig body"  # unchanged
    assert body["summary"] == "orig summary"  # unchanged when content not patched


async def test_patch_content_recomputes_summary_and_read_minutes(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_patch_2")
    long_first_para = "首段 " + "x" * 50
    r = await client.patch(
        f"/notes/{nid}",
        headers=auth_headers,
        json={"content": f"{long_first_para}\n\n第二段内容"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == long_first_para
    # content length > 1, read_minutes >= 1
    assert body["readMinutes"] >= 1


async def test_patch_empty_title_returns_422(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_patch_3")
    r = await client.patch(
        f"/notes/{nid}", headers=auth_headers, json={"title": "   "}
    )
    assert r.status_code == 422


async def test_delete_unauthenticated_returns_401(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_del_1")
    r = await client.delete(f"/notes/{nid}")
    assert r.status_code == 401


async def test_delete_other_users_note_returns_403(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = User(
        sid="20211099002",
        name="Other2",
        nickname="other",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    nid = await _seed_note(db_session, other.sid, "note_other_b")

    r = await client.delete(f"/notes/{nid}", headers=auth_headers)
    assert r.status_code == 403


async def test_delete_cascades_likes_and_comments(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_del_cascade")
    # Attach a like + comment from demo_user
    db_session.add(Like(note_id=nid, user_sid=demo_user.sid))
    db_session.add(
        Comment(
            id="cmt_cascade",
            note_id=nid,
            author_sid=demo_user.sid,
            content="hi",
        )
    )
    await db_session.commit()

    r = await client.delete(f"/notes/{nid}", headers=auth_headers)
    assert r.status_code == 204

    # Note gone
    assert await db_session.get(Note, nid) is None
    # Likes / comments cleaned up by CASCADE
    likes = (
        await db_session.execute(select(Like).where(Like.note_id == nid))
    ).scalars().all()
    comments = (
        await db_session.execute(select(Comment).where(Comment.note_id == nid))
    ).scalars().all()
    assert likes == []
    assert comments == []
