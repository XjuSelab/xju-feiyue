"""Seed the DB from content/notes/*.md.

Each markdown file is YAML-frontmatter + body. The single demo author is
`winbeau` (sid 20211010001 / password 123456). Safe to re-run — drops and
recreates all tables before seeding.
"""
from __future__ import annotations

import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import models  # noqa: E402,F401 - register on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.models import Note, User  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.services.auth import hash_password  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
NOTES_DIR = REPO_ROOT / "content" / "notes"

DEMO_PASSWORD = "123456"
DEMO_USER_ID = "usr_winbeau"
DEMO_USER_NAME = "winbeau"
DEMO_SID = "20211010001"
DEMO_BIO = "工程速查 + 深度学习环境配置"


_FRONT_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def parse_md(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    m = _FRONT_RE.match(raw)
    if not m:
        raise ValueError(f"{path}: no YAML frontmatter")
    front = yaml.safe_load(m.group(1))
    body = m.group(2).lstrip("\n")
    if not isinstance(front, dict):
        raise ValueError(f"{path}: frontmatter not a mapping")
    return front, body


async def main() -> None:
    if not NOTES_DIR.is_dir():
        raise SystemExit(f"missing {NOTES_DIR}; run scripts/notion_pull.py + scripts/wrap_frontmatter.py first")

    md_files = sorted(NOTES_DIR.glob("*.md"))
    if not md_files:
        raise SystemExit(f"no *.md found under {NOTES_DIR}")

    notes = []
    for path in md_files:
        front, body = parse_md(path)
        notes.append((front, body))

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    pwd_hash = hash_password(DEMO_PASSWORD)

    async with AsyncSessionLocal() as session:
        session.add(
            User(
                id=DEMO_USER_ID,
                sid=DEMO_SID,
                name=DEMO_USER_NAME,
                avatar=None,
                bio=DEMO_BIO,
                password_hash=pwd_hash,
            )
        )
        await session.flush()

        for front, body in notes:
            created = front.get("createdAt", "2026-05-09T00:00:00Z")
            if isinstance(created, str):
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            elif isinstance(created, datetime):
                created_dt = created
            else:
                raise ValueError(f"{front.get('slug')}: unrecognized createdAt {created!r}")
            session.add(
                Note(
                    id=str(front["id"]),
                    title=str(front["title"]),
                    summary=str(front.get("summary", "")),
                    content=body,
                    cover=None,
                    category=str(front.get("category", "tools")),
                    tags=list(front.get("tags") or []),
                    author_id=DEMO_USER_ID,
                    created_at=created_dt,
                    read_minutes=int(front.get("readMinutes", 1)),
                )
            )
        await session.commit()

    print(f"seed done: 1 user / {len(notes)} notes")
    print(f"demo: sid={DEMO_SID} / password={DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
