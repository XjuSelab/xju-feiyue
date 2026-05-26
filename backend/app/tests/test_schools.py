"""End-to-end tests for /schools/* using the real claw export as a fixture.

The fixture file at ``backend/data/schools/schools.sqlite`` was produced by
supervisor-claw v0.4 and contains 212 advisors across SJTU + PKU. Tests
that depend on it are skipped if the file is missing (so CI without the
out-of-band data doesn't fail noisily).
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.db.schools_engine import init_holder
from app.main import SCHOOLS_DATA_DIR


def _has_data() -> bool:
    return (SCHOOLS_DATA_DIR / "schools.sqlite").exists()


pytestmark = pytest.mark.skipif(
    not _has_data(),
    reason="backend/data/schools/schools.sqlite not present (out-of-band claw export)",
)


@pytest.fixture(autouse=True)
def _schools_holder():
    """Reset the singleton each test so a missing-file run can't leak in."""
    init_holder(SCHOOLS_DATA_DIR)
    yield


async def _boot(client):
    # Kick the holder via the first /schools/* hit; subsequent hits reuse it.
    r = await client.get("/schools/meta")
    assert r.status_code == 200, r.text
    return r


class TestMeta:
    async def test_returns_schools_with_counts_and_manifest(self, client):
        r = await _boot(client)
        meta = r.json()
        assert meta["manifest"]["claw_version"] == "0.4.0"
        codes = {s["code"] for s in meta["schools"]}
        assert {"pku", "sjtu"}.issubset(codes)
        # PKU has the bulk of the dataset.
        pku = next(s for s in meta["schools"] if s["code"] == "pku")
        assert pku["count"] > 100
        assert {d["code"] for d in pku["departments"]} >= {"ai", "cfcs", "eecs", "wangxuan"}
        # Titles are ranked by frequency, the very common one is first.
        assert meta["titles"][0] == "教授"


class TestList:
    async def test_school_filter_narrows(self, client):
        await _boot(client)
        r_all = await client.get("/schools/list", params={"page_size": 1})
        r_pku = await client.get("/schools/list", params={"school": "pku", "page_size": 1})
        assert r_pku.status_code == 200
        assert r_pku.json()["total"] < r_all.json()["total"]
        assert r_pku.json()["items"][0]["school"]["code"] == "pku"

    async def test_fts_chinese_search(self, client):
        await _boot(client)
        r = await client.get(
            "/schools/list", params={"q": "机器学习", "page_size": 3}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        # research_interests is parsed back to a list.
        for row in body["items"]:
            assert isinstance(row["research_interests"], list)

    async def test_title_other_inverse_set(self, client):
        await _boot(client)
        r = await client.get(
            "/schools/list", params=[("title", "其他"), ("page_size", 20)]
        )
        assert r.status_code == 200
        body = r.json()
        known = {"教授", "副教授", "助理教授", "研究员"}
        for row in body["items"]:
            assert row["title"] is None or row["title"] not in known

    async def test_recruit_multi_select(self, client):
        await _boot(client)
        r = await client.get(
            "/schools/list",
            params=[("recruit", "yes"), ("recruit", "no"), ("page_size", 50)],
        )
        assert r.status_code == 200
        for row in r.json()["items"]:
            assert row["is_recruiting"] in (True, False)

    async def test_has_email_filter(self, client):
        await _boot(client)
        r = await client.get(
            "/schools/list", params={"has_email": "true", "page_size": 25}
        )
        assert r.status_code == 200
        for row in r.json()["items"]:
            assert row["email"]

    async def test_sort_updated_desc(self, client):
        await _boot(client)
        r = await client.get(
            "/schools/list",
            params={"sort_key": "updated", "sort_dir": "desc", "page_size": 10},
        )
        assert r.status_code == 200
        ts = [row["last_enriched_at"] for row in r.json()["items"] if row["last_enriched_at"]]
        # Non-null timestamps come first, in descending order.
        assert ts == sorted(ts, reverse=True)

    async def test_pagination(self, client):
        await _boot(client)
        r1 = await client.get("/schools/list", params={"page": 1, "page_size": 5})
        r2 = await client.get("/schools/list", params={"page": 2, "page_size": 5})
        ids1 = [x["id"] for x in r1.json()["items"]]
        ids2 = [x["id"] for x in r2.json()["items"]]
        assert len(ids1) == 5 and len(ids2) == 5
        assert not (set(ids1) & set(ids2))

    async def test_unicode_q_with_special_chars_does_not_crash_fts(self, client):
        await _boot(client)
        r = await client.get("/schools/list", params={"q": '"机器学习" AND'})
        assert r.status_code == 200  # FTS escape neutralises metachars

    async def test_pinyin_full_match(self, client):
        # 姜少峰 (advisor 193) → full pinyin "jiangshaofeng".
        await _boot(client)
        r = await client.get(
            "/schools/list", params={"q": "jiangshaofeng", "page_size": 50}
        )
        assert r.status_code == 200
        assert 193 in {row["id"] for row in r.json()["items"]}

    async def test_pinyin_initials_match(self, client):
        # 姜少峰 → initials "jsf".
        await _boot(client)
        r = await client.get("/schools/list", params={"q": "jsf", "page_size": 50})
        assert r.status_code == 200
        assert 193 in {row["id"] for row in r.json()["items"]}

    async def test_chinese_substring_in_interests(self, client):
        # "学习" is a substring of "机器学习" — unicode61 keeps that one token,
        # so this only works via the substring LIKE branch, not FTS.
        await _boot(client)
        r = await client.get("/schools/list", params={"q": "学习", "page_size": 50})
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    async def test_pinyin_combines_with_school_filter(self, client):
        # Pinyin search AND school filter — every hit must be in the school.
        await _boot(client)
        r = await client.get(
            "/schools/list",
            params={"q": "jiang", "school": "pku", "page_size": 50},
        )
        assert r.status_code == 200
        for row in r.json()["items"]:
            assert row["school"]["code"] == "pku"


class TestDetail:
    async def test_known_advisor_has_nested_data(self, client):
        await _boot(client)
        r = await client.get("/schools/193")
        assert r.status_code == 200
        d = r.json()
        assert d["name_cn"] == "姜少峰"
        assert any(dept["code"] == "cfcs" for dept in d["departments"])
        assert len(d["evaluations"]) >= 1
        assert isinstance(d["trace"], list)  # trace table may be empty in v0.4

    async def test_missing_advisor_404(self, client):
        await _boot(client)
        r = await client.get("/schools/999999")
        assert r.status_code == 404


class TestAdmin:
    async def test_reload_requires_auth(self, client):
        await _boot(client)
        r = await client.post("/admin/schools/reload")
        assert r.status_code == 401

    async def test_reload_blocks_non_admin(self, client, auth_headers):
        await _boot(client)
        # demo_user is NOT the admin (admin_sid mismatch → 404).
        r = await client.post("/admin/schools/reload", headers=auth_headers)
        assert r.status_code == 404


class TestDataMissing:
    async def test_503_when_file_absent(self, client, tmp_path, monkeypatch):
        # Point the holder at an empty directory before issuing the request.
        empty = tmp_path / "no-schools"
        empty.mkdir()
        init_holder(empty)
        r = await client.get("/schools/list")
        assert r.status_code == 503
        assert r.json()["detail"] == "schools data not ready"
