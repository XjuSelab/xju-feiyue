"""Author-alignment scanner / repairer tests."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from app.db import models
from app.services import author_sync


@pytest.fixture(autouse=True)
def _fixture_notes_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect the frontmatter reader at fake content/notes for this test."""
    notes = tmp_path / "content" / "notes"
    notes.mkdir(parents=True)
    monkeypatch.setattr(author_sync, "NOTES_DIR", notes)
    return notes


def _write_note(notes_dir: Path, *, note_id: str, slug: str, author: str) -> None:
    body = (
        f"---\n"
        f"id: {note_id}\n"
        f"slug: {slug}\n"
        f"title: {slug}\n"
        f"category: tools\n"
        f"author: {author}\n"
        f"---\n\nbody\n"
    )
    (notes_dir / f"{slug}.md").write_text(body, encoding="utf-8")


async def _seed(db: Any, *, users: list[tuple[str, str]], notes: list[tuple[str, str]]) -> None:
    """users = [(sid, nickname), ...], notes = [(note_id, author_sid), ...]"""
    for sid, nick in users:
        db.add(
            models.User(
                sid=sid,
                name=nick,
                nickname=nick,
                password_hash="x",
            )
        )
    await db.flush()
    for nid, author_sid in notes:
        db.add(
            models.Note(
                id=nid,
                title=nid,
                summary="",
                content="",
                category="tools",
                tags=[],
                author_sid=author_sid,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                read_minutes=1,
            )
        )
    await db.commit()


@pytest.mark.asyncio
async def test_scan_reports_no_drift_when_aligned(
    db_session: Any, _fixture_notes_dir: Path
) -> None:
    _write_note(_fixture_notes_dir, note_id="n1", slug="a", author="winbeau")
    await _seed(
        db_session,
        users=[("20241401231", "winbeau")],
        notes=[("n1", "20241401231")],
    )
    report = await author_sync.scan(db_session)
    assert report.checked == 1
    assert report.aligned == 1
    assert report.mismatches == []


@pytest.mark.asyncio
async def test_scan_detects_wrong_author_sid(
    db_session: Any, _fixture_notes_dir: Path
) -> None:
    _write_note(_fixture_notes_dir, note_id="n1", slug="a", author="winbeau")
    await _seed(
        db_session,
        users=[("20241401231", "winbeau"), ("20180000001", "孙海洋")],
        notes=[("n1", "20180000001")],  # wrongly assigned to 孙海洋
    )
    report = await author_sync.scan(db_session)
    assert report.aligned == 0
    assert len(report.mismatches) == 1
    m = report.mismatches[0]
    assert m.note_id == "n1"
    assert m.current_sid == "20180000001"
    assert m.expected_sid == "20241401231"
    assert m.expected_nickname == "winbeau"


@pytest.mark.asyncio
async def test_repair_fixes_drifted_notes(
    db_session: Any, _fixture_notes_dir: Path
) -> None:
    _write_note(_fixture_notes_dir, note_id="n1", slug="a", author="winbeau")
    _write_note(_fixture_notes_dir, note_id="n2", slug="b", author="孙海洋")
    await _seed(
        db_session,
        users=[("20241401231", "winbeau"), ("20180000001", "孙海洋")],
        notes=[("n1", "20180000001"), ("n2", "20180000001")],
    )
    report = await author_sync.repair(db_session)
    assert len(report.fixable) == 1
    # Re-scan: should now be clean.
    again = await author_sync.scan(db_session)
    assert again.mismatches == []


@pytest.mark.asyncio
async def test_unresolvable_when_frontmatter_nickname_unknown(
    db_session: Any, _fixture_notes_dir: Path
) -> None:
    _write_note(_fixture_notes_dir, note_id="n1", slug="a", author="ghost")
    await _seed(
        db_session,
        users=[("20241401231", "winbeau")],
        notes=[("n1", "20241401231")],
    )
    report = await author_sync.scan(db_session)
    assert len(report.unresolvable) == 1
    assert report.unresolvable[0].expected_sid is None


@pytest.mark.asyncio
async def test_db_only_notes_are_left_alone(
    db_session: Any, _fixture_notes_dir: Path
) -> None:
    # No MD file for "ui_created" — it was written via the writer UI.
    await _seed(
        db_session,
        users=[("20241401231", "winbeau")],
        notes=[("ui_created", "20241401231")],
    )
    report = await author_sync.scan(db_session)
    assert report.mismatches == []
    assert report.db_only == ["ui_created"]
