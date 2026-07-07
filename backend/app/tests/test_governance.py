"""Governance tests — reports, admin moderation, blocks + block filtering."""
from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Note, User
from app.services.auth import hash_password

AUTHOR = "20880000001"
ADMIN = "20880000002"


async def _seed_user(
    db: AsyncSession, sid: str, nickname: str = "u", role: str | None = None
) -> User:
    db.add(
        User(
            sid=sid,
            name=nickname,
            nickname=nickname,
            password_hash=hash_password("123456"),
            role=role,
        )
    )
    await db.commit()
    return await db.get(User, sid)  # type: ignore[return-value]


async def _login(client: AsyncClient, sid: str) -> dict[str, str]:
    r = await client.post("/auth/login", json={"sid": sid, "password": "123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _seed_note(db: AsyncSession, owner_sid: str, note_id: str) -> str:
    db.add(
        Note(
            id=note_id,
            title="T",
            summary="s",
            content="body",
            category="research",
            tags=[],
            author_sid=owner_sid,
            created_at=datetime.now(timezone.utc),
            read_minutes=1,
            status="visible",
        )
    )
    await db.commit()
    return note_id


async def _feed_ids(client: AsyncClient, headers: dict[str, str]) -> list[str]:
    r = await client.get("/notes", headers=headers)
    assert r.status_code == 200, r.text
    return [n["id"] for n in r.json()["items"]]


async def test_report_note_list_and_resolve_hide(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    await _seed_user(db_session, AUTHOR, "author")
    await _seed_note(db_session, AUTHOR, "gov_n1")
    admin_h = await _login(client, (await _seed_user(db_session, ADMIN, "adm", role="admin")).sid)

    # reporter files a report
    r = await client.post(
        "/reports",
        headers=auth_headers,
        json={"targetType": "note", "targetId": "gov_n1", "reason": "spam"},
    )
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "pending"

    # admin sees it in the queue
    lst = await client.get("/reports", headers=admin_h)
    assert lst.status_code == 200
    assert [x["id"] for x in lst.json()] == [rid]

    # admin hides the note → drops out of the feed
    assert "gov_n1" in await _feed_ids(client, auth_headers)
    res = await client.post(
        f"/reports/{rid}/resolve", headers=admin_h, json={"action": "hide"}
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "resolved"
    assert res.json()["resolutionAction"] == "hide"
    assert "gov_n1" not in await _feed_ids(client, auth_headers)


async def test_report_dedupe(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    await _seed_user(db_session, AUTHOR, "author")
    await _seed_note(db_session, AUTHOR, "gov_n2")
    admin_h = await _login(client, (await _seed_user(db_session, ADMIN, "adm", role="admin")).sid)

    body = {"targetType": "note", "targetId": "gov_n2", "reason": "spam"}
    r1 = await client.post("/reports", headers=auth_headers, json=body)
    r2 = await client.post("/reports", headers=auth_headers, json=body)
    assert r1.json()["id"] == r2.json()["id"]  # same open report reused
    lst = await client.get("/reports", headers=admin_h)
    assert len(lst.json()) == 1


async def test_report_target_not_found(
    client: AsyncClient, demo_user: User, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/reports",
        headers=auth_headers,
        json={"targetType": "note", "targetId": "nope", "reason": "spam"},
    )
    assert r.status_code == 404


async def test_resolve_delete_removes_note(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    await _seed_user(db_session, AUTHOR, "author")
    await _seed_note(db_session, AUTHOR, "gov_n3")
    admin_h = await _login(client, (await _seed_user(db_session, ADMIN, "adm", role="admin")).sid)

    r = await client.post(
        "/reports",
        headers=auth_headers,
        json={"targetType": "note", "targetId": "gov_n3", "reason": "illegal"},
    )
    rid = r.json()["id"]
    res = await client.post(
        f"/reports/{rid}/resolve", headers=admin_h, json={"action": "delete"}
    )
    assert res.status_code == 200
    assert (await client.get("/notes/get", params={"id": "gov_n3"})).status_code == 404


async def test_list_reports_admin_only(
    client: AsyncClient, demo_user: User, auth_headers: dict[str, str]
) -> None:
    # a plain user can't even see the report queue exists → 404
    assert (await client.get("/reports", headers=auth_headers)).status_code == 404


async def test_report_comment_resolve_hide(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    author_h = await _login(client, (await _seed_user(db_session, AUTHOR, "author")).sid)
    await _seed_note(db_session, AUTHOR, "gov_n4")
    admin_h = await _login(client, (await _seed_user(db_session, ADMIN, "adm", role="admin")).sid)

    c = await client.post(
        "/notes/gov_n4/comments", headers=author_h, json={"content": "垃圾评论"}
    )
    assert c.status_code == 201, c.text
    cid = c.json()["id"]

    r = await client.post(
        "/reports",
        headers=auth_headers,
        json={"targetType": "comment", "targetId": cid, "reason": "harassment"},
    )
    rid = r.json()["id"]
    await client.post(f"/reports/{rid}/resolve", headers=admin_h, json={"action": "hide"})

    listed = await client.get("/notes/gov_n4/comments")
    assert cid not in [x["id"] for x in listed.json()["items"]]


async def test_block_hides_notes_and_unblock_restores(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    await _seed_user(db_session, AUTHOR, "author")
    await _seed_note(db_session, AUTHOR, "gov_n5")

    assert "gov_n5" in await _feed_ids(client, auth_headers)
    assert (await client.post(f"/blocks/{AUTHOR}", headers=auth_headers)).status_code == 204
    assert "gov_n5" not in await _feed_ids(client, auth_headers)
    assert (await client.delete(f"/blocks/{AUTHOR}", headers=auth_headers)).status_code == 204
    assert "gov_n5" in await _feed_ids(client, auth_headers)


async def test_block_self_forbidden(
    client: AsyncClient, demo_user: User, auth_headers: dict[str, str]
) -> None:
    r = await client.post(f"/blocks/{demo_user.sid}", headers=auth_headers)
    assert r.status_code == 422


async def test_list_blocks(
    client: AsyncClient,
    demo_user: User,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    await _seed_user(db_session, AUTHOR, "author")
    await client.post(f"/blocks/{AUTHOR}", headers=auth_headers)
    r = await client.get("/blocks", headers=auth_headers)
    assert r.status_code == 200
    assert [b["user"]["sid"] for b in r.json()] == [AUTHOR]
