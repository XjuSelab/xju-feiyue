"""Notes route tests — list / hot / latest / liked / get + camelCase wire format."""
from __future__ import annotations

from httpx import AsyncClient


async def test_list_default_returns_all_5_sorted_latest(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes")
    assert r.status_code == 200
    body = r.json()

    assert set(body.keys()) == {"items", "nextCursor"}
    items = body["items"]
    assert len(items) == 5  # less than default limit 6, so single page
    assert [n["id"] for n in items] == [
        "note_005",
        "note_004",
        "note_003",
        "note_002",
        "note_001",
    ]
    assert body["nextCursor"] is None


async def test_list_filter_by_cat(client: AsyncClient, seeded_notes) -> None:
    r = await client.get("/notes?cat=research")
    items = r.json()["items"]
    assert {n["id"] for n in items} == {"note_001", "note_003"}
    assert all(n["category"] == "research" for n in items)


async def test_list_filter_by_q_case_insensitive(
    client: AsyncClient, seeded_notes
) -> None:
    # Matches title "Kaggle B" / "Kaggle D" + summary "Kaggle in summary C"
    r = await client.get("/notes?q=kaggle")
    ids = {n["id"] for n in r.json()["items"]}
    assert ids == {"note_002", "note_003", "note_004"}


async def test_list_filter_by_tag(client: AsyncClient, seeded_notes) -> None:
    r = await client.get("/notes?tags=tag-c")
    ids = [n["id"] for n in r.json()["items"]]
    assert ids == ["note_004"]


async def test_list_sort_hot(client: AsyncClient, seeded_notes) -> None:
    """sort=hot orders by (likes + comments) desc, ties broken by createdAt desc."""
    r = await client.get("/notes?sort=hot")
    ids = [n["id"] for n in r.json()["items"]]
    # Engagement scores: 004=5, 005=2, 003=2, 002=2, 001=0
    # Among ties at 2: 005(1d) > 003(3d) > 002(4d)
    assert ids == ["note_004", "note_005", "note_003", "note_002", "note_001"]


async def test_list_sort_liked(client: AsyncClient, seeded_notes) -> None:
    """sort=liked orders by likes desc, ties broken by createdAt desc."""
    r = await client.get("/notes?sort=liked")
    ids = [n["id"] for n in r.json()["items"]]
    # Likes: 004=3, 003=2, 005=1, 002=1, 001=0
    # 005 vs 002 tie at 1: 005 newer
    assert ids == ["note_004", "note_003", "note_005", "note_002", "note_001"]


async def test_list_with_limit_returns_next_cursor(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes?limit=2")
    body = r.json()
    assert len(body["items"]) == 2
    assert body["items"][0]["id"] == "note_005"
    assert body["nextCursor"] == "note_004"


async def test_list_cursor_pagination_walks_all_pages(
    client: AsyncClient, seeded_notes
) -> None:
    seen: list[str] = []
    cursor: str | None = None
    while True:
        url = f"/notes?limit=2{f'&cursor={cursor}' if cursor else ''}"
        body = (await client.get(url)).json()
        seen.extend(n["id"] for n in body["items"])
        cursor = body["nextCursor"]
        if cursor is None:
            break
    assert seen == ["note_005", "note_004", "note_003", "note_002", "note_001"]


async def test_hot_endpoint_returns_top_by_engagement(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes/hot")
    ids = [n["id"] for n in r.json()]
    assert ids[0] == "note_004"  # 3 likes + 2 comments = 5
    assert len(ids) <= 6


async def test_latest_endpoint_returns_top_8_by_created(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes/latest")
    ids = [n["id"] for n in r.json()]
    # Only 5 fixtures, all returned
    assert ids == ["note_005", "note_004", "note_003", "note_002", "note_001"]


async def test_liked_endpoint_orders_by_likes_count(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes/liked")
    ids = [n["id"] for n in r.json()]
    assert ids[0] == "note_004"


async def test_get_one_existing_includes_full_camelcase_shape(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes/get?id=note_004")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "note_004"
    assert body["title"] == "Kaggle D"
    assert body["category"] == "kaggle"
    assert body["likes"] == 3
    assert body["comments"] == 2
    assert body["readMinutes"] == 5
    # camelCase keys present, snake_case absent
    assert "createdAt" in body
    assert "created_at" not in body
    # Author shape
    assert body["author"]["id"] == "usr_test_00"
    assert body["author"]["name"] == "User 0"


async def test_get_one_missing_returns_404(
    client: AsyncClient, seeded_notes
) -> None:
    r = await client.get("/notes/get?id=does-not-exist")
    assert r.status_code == 404
    assert r.json() == {"detail": "笔记不存在"}


async def test_get_one_no_id_param_returns_422(client: AsyncClient) -> None:
    r = await client.get("/notes/get")
    assert r.status_code == 422
