"""Collections route tests."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Note, User
from app.services.auth import hash_password


async def _seed_user(db_session: AsyncSession, sid: str, nickname: str) -> User:
    user = User(
        sid=sid,
        name=nickname,
        nickname=nickname,
        password_hash=hash_password("123456"),
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _login(client: AsyncClient, sid: str) -> dict[str, str]:
    r = await client.post("/auth/login", json={"sid": sid, "password": "123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _seed_note(
    db_session: AsyncSession,
    owner_sid: str,
    note_id: str,
    *,
    status: str = "visible",
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
        status=status,
    )
    db_session.add(note)
    await db_session.commit()
    return note.id


async def test_collection_create_add_and_context(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid, "note_col_a")

    created = await client.post(
        "/collections",
        headers=auth_headers,
        json={"title": "专题合集", "description": "desc"},
    )
    assert created.status_code == 201, created.text
    collection_id = created.json()["id"]

    added = await client.post(
        f"/collections/{collection_id}/entries",
        headers=auth_headers,
        json={"noteId": note_id},
    )
    assert added.status_code == 200, added.text
    assert added.json()["entryCount"] == 1
    assert added.json()["entries"][0]["id"] == note_id

    ctx = await client.get(f"/notes/{note_id}/collection")
    assert ctx.status_code == 200
    body = ctx.json()
    assert body["collection"]["id"] == collection_id
    assert body["currentIndex"] == 0
    assert body["entries"][0]["id"] == note_id


async def test_collection_rejects_other_users_note(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = await _seed_user(db_session, "20211099111", "other")
    other_note = await _seed_note(db_session, other.sid, "note_col_other")

    created = await client.post(
        "/collections",
        headers=auth_headers,
        json={"title": "我的合集", "description": ""},
    )
    assert created.status_code == 201
    collection_id = created.json()["id"]

    added = await client.post(
        f"/collections/{collection_id}/entries",
        headers=auth_headers,
        json={"noteId": other_note},
    )
    assert added.status_code == 403


async def test_collection_rejects_note_already_in_other_collection(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    note_id = await _seed_note(db_session, demo_user.sid, "note_col_dup")

    c1 = await client.post(
        "/collections",
        headers=auth_headers,
        json={"title": "合集1", "description": ""},
    )
    c2 = await client.post(
        "/collections",
        headers=auth_headers,
        json={"title": "合集2", "description": ""},
    )
    assert c1.status_code == 201
    assert c2.status_code == 201

    r1 = await client.post(
        f"/collections/{c1.json()['id']}/entries",
        headers=auth_headers,
        json={"noteId": note_id},
    )
    assert r1.status_code == 200

    r2 = await client.post(
        f"/collections/{c2.json()['id']}/entries",
        headers=auth_headers,
        json={"noteId": note_id},
    )
    assert r2.status_code == 409

async def test_reorder_collection_entries(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    r = await client.post(
        "/collections", headers=auth_headers, json={"title": "C", "description": ""}
    )
    assert r.status_code == 201, r.text
    cid = r.json()["id"]

    ids: list[str] = []
    for i in range(3):
        nid = await _seed_note(db_session, demo_user.sid, f"reorder_n{i}")
        ids.append(nid)
        ra = await client.post(
            f"/collections/{cid}/entries", headers=auth_headers, json={"noteId": nid}
        )
        assert ra.status_code == 200, ra.text

    # default order = insertion order
    detail = (await client.get(f"/collections/{cid}")).json()
    assert [e["id"] for e in detail["entries"]] == ids

    # reorder reversed → persists
    rev = list(reversed(ids))
    rr = await client.patch(
        f"/collections/{cid}/entries/order", headers=auth_headers, json={"noteIds": rev}
    )
    assert rr.status_code == 200, rr.text
    assert [e["id"] for e in rr.json()["entries"]] == rev
    detail2 = (await client.get(f"/collections/{cid}")).json()
    assert [e["id"] for e in detail2["entries"]] == rev


async def test_reorder_requires_owner(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    r = await client.post(
        "/collections", headers=auth_headers, json={"title": "C", "description": ""}
    )
    cid = r.json()["id"]
    await _seed_user(db_session, "20990000001", "other")
    other = await _login(client, "20990000001")
    rr = await client.patch(
        f"/collections/{cid}/entries/order", headers=other, json={"noteIds": []}
    )
    assert rr.status_code == 403
