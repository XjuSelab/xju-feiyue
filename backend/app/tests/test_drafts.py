"""Drafts route tests — CRUD + publish + ownership 404 + 401 paths."""
from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Draft, Note, User
from app.services.auth import hash_password


async def test_create_draft_unauthenticated_returns_401(client: AsyncClient) -> None:
    r = await client.post("/notes/drafts", json={"title": "x"})
    assert r.status_code == 401


async def test_create_draft_returns_201_with_camelcase(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/notes/drafts",
        headers=auth_headers,
        json={"title": "Test draft", "content": "hello", "tags": ["t1", "t2"]},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Test draft"
    assert body["content"] == "hello"
    assert body["tags"] == ["t1", "t2"]
    assert body["category"] is None
    assert "updatedAt" in body and body["updatedAt"].endswith("Z")
    assert "id" in body


async def test_list_drafts_returns_only_mine(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
    demo_user: User,
) -> None:
    # Create one of mine via API
    await client.post(
        "/notes/drafts", headers=auth_headers, json={"title": "mine"}
    )
    # Create another user + their draft directly via DB
    other = User(
        id="usr_other",
        sid="20211019999",
        name="Other",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        Draft(id="draft_other", owner_id=other.id, title="other draft")
    )
    await db_session.commit()

    r = await client.get("/notes/drafts", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()
    titles = [d["title"] for d in items]
    assert "mine" in titles
    assert "other draft" not in titles


async def test_get_other_users_draft_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = User(
        id="usr_other2",
        sid="20211019998",
        name="Other2",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        Draft(id="draft_other2", owner_id=other.id, title="not yours")
    )
    await db_session.commit()

    r = await client.get("/notes/drafts/draft_other2", headers=auth_headers)
    assert r.status_code == 404
    assert r.json() == {"detail": "草稿不存在"}


async def test_get_unknown_draft_returns_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.get("/notes/drafts/does-not-exist", headers=auth_headers)
    assert r.status_code == 404


async def test_patch_only_specified_fields(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/notes/drafts",
        headers=auth_headers,
        json={"title": "T", "content": "C", "tags": ["a"], "category": "kaggle"},
    )
    draft_id = create.json()["id"]

    # Patch only the title
    patched = await client.patch(
        f"/notes/drafts/{draft_id}",
        headers=auth_headers,
        json={"title": "T2"},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "T2"
    assert body["content"] == "C"  # unchanged
    assert body["tags"] == ["a"]  # unchanged
    assert body["category"] == "kaggle"  # unchanged


async def test_delete_draft_204(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/notes/drafts", headers=auth_headers, json={"title": "to-delete"}
    )
    draft_id = create.json()["id"]
    r = await client.delete(f"/notes/drafts/{draft_id}", headers=auth_headers)
    assert r.status_code == 204
    # Confirm gone
    g = await client.get(f"/notes/drafts/{draft_id}", headers=auth_headers)
    assert g.status_code == 404


async def test_publish_missing_title_returns_422(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/notes/drafts",
        headers=auth_headers,
        json={"content": "body", "category": "kaggle"},
    )
    draft_id = create.json()["id"]
    r = await client.post(
        f"/notes/drafts/{draft_id}/publish", headers=auth_headers
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "发布前必须填写标题"


async def test_publish_missing_category_returns_422(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/notes/drafts",
        headers=auth_headers,
        json={"title": "hi", "content": "body"},
    )
    draft_id = create.json()["id"]
    r = await client.post(
        f"/notes/drafts/{draft_id}/publish", headers=auth_headers
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "发布前必须选择分类"


async def test_publish_full_round_trip(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    create = await client.post(
        "/notes/drafts",
        headers=auth_headers,
        json={
            "title": "我的发布",
            "content": "正文第一段。\n\n第二段细节。",
            "category": "kaggle",
            "tags": ["t1"],
        },
    )
    draft_id = create.json()["id"]

    r = await client.post(
        f"/notes/drafts/{draft_id}/publish", headers=auth_headers
    )
    assert r.status_code == 200
    note = r.json()

    # NoteOut shape check
    assert note["title"] == "我的发布"
    assert note["category"] == "kaggle"
    assert note["tags"] == ["t1"]
    assert note["likes"] == 0
    assert note["comments"] == 0
    assert note["readMinutes"] >= 1
    assert note["author"]["id"] == "usr_test_zilun"
    assert note["createdAt"].endswith("Z")
    # Auto summary = first paragraph
    assert note["summary"] == "正文第一段。"

    # Draft row should be gone
    drafts = await db_session.execute(
        Draft.__table__.select().where(Draft.id == draft_id)  # type: ignore[arg-type]
    )
    assert drafts.first() is None
    # Note row should exist
    note_row = await db_session.get(Note, note["id"])
    assert note_row is not None
    assert note_row.author_id == "usr_test_zilun"


async def test_publish_other_user_draft_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = User(
        id="usr_other3",
        sid="20211019997",
        name="Other3",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        Draft(
            id="draft_other3",
            owner_id=other.id,
            title="not mine",
            content="x",
            category="kaggle",
        )
    )
    await db_session.commit()

    r = await client.post(
        "/notes/drafts/draft_other3/publish", headers=auth_headers
    )
    assert r.status_code == 404


async def test_patch_other_user_draft_returns_404(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
) -> None:
    other = User(
        id="usr_other4",
        sid="20211019996",
        name="Other4",
        password_hash=hash_password("123456"),
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        Draft(id="draft_other4", owner_id=other.id, title="locked")
    )
    await db_session.commit()

    r = await client.patch(
        "/notes/drafts/draft_other4",
        headers=auth_headers,
        json={"title": "hijack"},
    )
    assert r.status_code == 404
