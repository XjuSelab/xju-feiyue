"""Comments route tests — list/create/delete + permission + cascade."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Comment, Note, User
from app.services.auth import hash_password


async def _seed_note(
    db_session: AsyncSession, owner_sid: str, note_id: str = "note_comments_a"
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
    db_session: AsyncSession, sid: str, nickname: str = "other"
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


async def test_list_empty(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.get(f"/notes/{nid}/comments")
    assert r.status_code == 200
    assert r.json() == {"items": [], "nextCursor": None}


async def test_create_requires_auth(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.post(f"/notes/{nid}/comments", json={"content": "hi"})
    assert r.status_code == 401


async def test_create_missing_note_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/notes/nope/comments", headers=auth_headers, json={"content": "hi"}
    )
    assert r.status_code == 404


async def test_create_round_trip(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.post(
        f"/notes/{nid}/comments",
        headers=auth_headers,
        json={"content": "first comment"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["content"] == "first comment"
    assert body["noteId"] == nid
    assert body["author"]["sid"] == demo_user.sid
    assert body["anchorText"] is None
    assert body["createdAt"].endswith("Z")

    # GET returns the new comment
    lst = await client.get(f"/notes/{nid}/comments")
    assert lst.status_code == 200
    items = lst.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "first comment"


async def test_create_with_anchor(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.post(
        f"/notes/{nid}/comments",
        headers=auth_headers,
        json={
            "content": "对这段不同意",
            "anchorText": "选中的引用文字",
            "anchorOffsetStart": 10,
            "anchorOffsetEnd": 18,
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["anchorText"] == "选中的引用文字"
    assert body["anchorOffsetStart"] == 10
    assert body["anchorOffsetEnd"] == 18


async def test_list_pagination_desc(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    base = datetime.now(timezone.utc)
    for i in range(5):
        db_session.add(
            Comment(
                id=f"cmt_{i}",
                note_id=nid,
                author_sid=demo_user.sid,
                content=f"c{i}",
                created_at=base - timedelta(minutes=i),
            )
        )
    await db_session.commit()

    r = await client.get(f"/notes/{nid}/comments", params={"limit": 3})
    assert r.status_code == 200
    body = r.json()
    items = body["items"]
    # Newest first
    assert [c["content"] for c in items] == ["c0", "c1", "c2"]
    assert body["nextCursor"] == "cmt_2"

    # Walk next page
    r2 = await client.get(
        f"/notes/{nid}/comments",
        params={"cursor": "cmt_2", "limit": 3},
    )
    assert r2.status_code == 200
    body2 = r2.json()
    assert [c["content"] for c in body2["items"]] == ["c3", "c4"]
    assert body2["nextCursor"] is None


async def test_delete_requires_auth(
    client: AsyncClient, demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    db_session.add(
        Comment(id="cmt_x", note_id=nid, author_sid=demo_user.sid, content="x")
    )
    await db_session.commit()
    r = await client.delete(f"/notes/{nid}/comments/cmt_x")
    assert r.status_code == 401


async def test_delete_404_when_missing_or_wrong_note(
    client: AsyncClient, auth_headers: dict[str, str], demo_user: User, db_session: AsyncSession
) -> None:
    nid = await _seed_note(db_session, demo_user.sid)
    r = await client.delete(
        f"/notes/{nid}/comments/does-not-exist", headers=auth_headers
    )
    assert r.status_code == 404


async def test_delete_403_for_third_party(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    # Another user owns the note AND wrote the comment. demo_user is just a viewer.
    other = await _seed_user(db_session, "20211099003", "other-author")
    nid = await _seed_note(db_session, other.sid, "note_other_z")
    db_session.add(
        Comment(id="cmt_third", note_id=nid, author_sid=other.sid, content="x")
    )
    await db_session.commit()

    r = await client.delete(
        f"/notes/{nid}/comments/cmt_third", headers=auth_headers
    )
    assert r.status_code == 403


async def test_delete_204_by_comment_author(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    other = await _seed_user(db_session, "20211099004", "note-owner")
    nid = await _seed_note(db_session, other.sid, "note_owned_by_other")
    db_session.add(
        Comment(
            id="cmt_mine", note_id=nid, author_sid=demo_user.sid, content="x"
        )
    )
    await db_session.commit()

    r = await client.delete(
        f"/notes/{nid}/comments/cmt_mine", headers=auth_headers
    )
    assert r.status_code == 204
    assert await db_session.get(Comment, "cmt_mine") is None


async def test_delete_204_by_note_author(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    # demo_user owns the note; someone else commented.
    other = await _seed_user(db_session, "20211099005", "stranger")
    nid = await _seed_note(db_session, demo_user.sid, "note_mod_target")
    db_session.add(
        Comment(
            id="cmt_to_moderate",
            note_id=nid,
            author_sid=other.sid,
            content="spam?",
        )
    )
    await db_session.commit()

    r = await client.delete(
        f"/notes/{nid}/comments/cmt_to_moderate", headers=auth_headers
    )
    assert r.status_code == 204


async def test_delete_note_cascades_comments(
    client: AsyncClient,
    auth_headers: dict[str, str],
    demo_user: User,
    db_session: AsyncSession,
) -> None:
    nid = await _seed_note(db_session, demo_user.sid, "note_cascade_cmt")
    db_session.add(
        Comment(id="cmt_c1", note_id=nid, author_sid=demo_user.sid, content="a")
    )
    db_session.add(
        Comment(id="cmt_c2", note_id=nid, author_sid=demo_user.sid, content="b")
    )
    await db_session.commit()

    r = await client.delete(f"/notes/{nid}", headers=auth_headers)
    assert r.status_code == 204

    remaining = (
        await db_session.execute(select(Comment).where(Comment.note_id == nid))
    ).scalars().all()
    assert remaining == []
