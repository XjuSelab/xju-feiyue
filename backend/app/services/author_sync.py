"""Author-alignment scanner & repairer.

Source-of-truth for "who owns which note" is the markdown frontmatter at
`content/notes/*.md` — `seed.py` reads it on every reseed. The DB column
`notes.author_sid` is a FK that *should* match the frontmatter author's
current sid. Drift can creep in when:

  - A user's nickname is edited in the UI but the MD file still says the
    old nickname (frontmatter goes stale).
  - A note is reassigned manually in the DB but the MD file isn't updated.
  - The seed `USERS` table grows a new account and old MD files reference
    a nickname that now resolves to a different sid.

This module reconciles the two: it reads frontmatter as the intent, then
compares against the DB. The `repair` action only touches `notes.author_sid`
— it never rewrites MD files, since user-facing edits flow through the
DB, not disk.

Notes that exist only in the DB (created via the writer UI) are out of
scope: there's no frontmatter to compare against, so they're left alone.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Note, User

REPO_ROOT = Path(__file__).resolve().parents[3]
NOTES_DIR = REPO_ROOT / "content" / "notes"
_FRONT_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


@dataclass(frozen=True)
class Mismatch:
    note_id: str
    title: str
    current_sid: str
    current_nickname: str | None
    expected_nickname: str
    expected_sid: str | None  # None if the nickname doesn't resolve to a user
    reason: str


@dataclass
class SyncReport:
    checked: int
    aligned: int
    mismatches: list[Mismatch]
    md_orphans: list[str]  # MD files with no matching DB row (note_id)
    db_only: list[str]  # DB notes with no matching MD file (note_id)

    @property
    def fixable(self) -> list[Mismatch]:
        return [m for m in self.mismatches if m.expected_sid is not None]

    @property
    def unresolvable(self) -> list[Mismatch]:
        return [m for m in self.mismatches if m.expected_sid is None]


def _read_frontmatter_authors() -> dict[str, str]:
    """Return {note_id: author_nickname} from content/notes/*.md."""
    out: dict[str, str] = {}
    if not NOTES_DIR.is_dir():
        return out
    for path in sorted(NOTES_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        m = _FRONT_RE.match(raw)
        if not m:
            continue
        front = yaml.safe_load(m.group(1)) or {}
        note_id = front.get("id")
        author = front.get("author")
        if isinstance(note_id, str) and isinstance(author, str) and author.strip():
            out[note_id] = author.strip()
    return out


async def _load_users_by_nickname(db: AsyncSession) -> dict[str, User]:
    rows = (await db.execute(select(User))).scalars().all()
    return {u.nickname: u for u in rows}


async def scan(db: AsyncSession) -> SyncReport:
    """Diff frontmatter author ↔ DB author_sid. Read-only."""
    md_authors = _read_frontmatter_authors()
    users_by_nick = await _load_users_by_nickname(db)
    notes = (
        (await db.execute(select(Note).join(User, Note.author_sid == User.sid)))
        .scalars()
        .all()
    )

    db_ids = {n.id for n in notes}
    md_orphans = sorted(nid for nid in md_authors if nid not in db_ids)
    db_only = sorted(n.id for n in notes if n.id not in md_authors)

    mismatches: list[Mismatch] = []
    aligned = 0
    for note in notes:
        expected_nick = md_authors.get(note.id)
        if expected_nick is None:
            continue  # DB-only note; out of scope
        current_user = users_by_nick.get(note.author.nickname) or note.author
        if current_user.nickname == expected_nick:
            aligned += 1
            continue
        target = users_by_nick.get(expected_nick)
        mismatches.append(
            Mismatch(
                note_id=note.id,
                title=note.title,
                current_sid=note.author_sid,
                current_nickname=note.author.nickname,
                expected_nickname=expected_nick,
                expected_sid=target.sid if target else None,
                reason=(
                    "frontmatter author has no matching user"
                    if target is None
                    else "author_sid points to a different user than frontmatter"
                ),
            )
        )

    return SyncReport(
        checked=len(notes),
        aligned=aligned,
        mismatches=mismatches,
        md_orphans=md_orphans,
        db_only=db_only,
    )


async def repair(db: AsyncSession) -> SyncReport:
    """Run scan, then update `author_sid` for every fixable mismatch."""
    report = await scan(db)
    if not report.fixable:
        return report
    by_id: dict[str, Mismatch] = {m.note_id: m for m in report.fixable}
    notes = (
        (await db.execute(select(Note).where(Note.id.in_(by_id.keys()))))
        .scalars()
        .all()
    )
    for note in notes:
        m = by_id[note.id]
        assert m.expected_sid is not None
        note.author_sid = m.expected_sid
    await db.commit()
    return report
