"""End-to-end tests for /conferences (seeded sqlite fixture)."""
from __future__ import annotations

from pathlib import Path

import pytest

from app.db.conferences_engine import init_holder
from app.main import CONFERENCES_DATA_DIR


def _has_data() -> bool:
    return (CONFERENCES_DATA_DIR / "conferences.sqlite").exists()


pytestmark = pytest.mark.skipif(
    not _has_data(),
    reason="backend/data/conferences/conferences.sqlite not present",
)


@pytest.fixture(autouse=True)
def _conferences_holder():
    init_holder(CONFERENCES_DATA_DIR)
    yield


class TestList:
    async def test_returns_all_rows(self, client):
        r = await client.get("/conferences/list")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["count"] == 230
        assert len(body["conferences"]) == 230
        assert body["manifest"]["conferences_sqlite_sha256"]

    async def test_row_shape(self, client):
        body = (await client.get("/conferences/list")).json()
        for c in body["conferences"]:
            assert c["id"] and c["abbr"] and c["name_full"]
            assert c["tier"] in ("A", "B", "C")

    async def test_acceptance_stats_seeded(self, client):
        body = (await client.get("/conferences/list")).json()
        cvpr = next(c for c in body["conferences"] if c["abbr"] == "CVPR")
        assert cvpr["submissions"] == 11532
        assert cvpr["acceptance_rate"] == 23.6
        assert cvpr["stats_year"] == 2024


class TestAdmin:
    async def test_reload_requires_auth(self, client):
        r = await client.post("/admin/conferences/reload")
        assert r.status_code == 401


class TestDataMissing:
    async def test_503_when_file_absent(self, client, tmp_path):
        empty = tmp_path / "no-conferences"
        empty.mkdir()
        init_holder(empty)
        r = await client.get("/conferences/list")
        assert r.status_code == 503
        assert r.json()["detail"] == "conferences data not ready"
