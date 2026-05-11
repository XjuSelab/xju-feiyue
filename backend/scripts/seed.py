"""Seed the DB from content/notes/*.md.

Each markdown file is YAML-frontmatter + body. The frontmatter `author`
field is the nickname (what's shown on cards); we resolve nickname →
user sid here. winbeau is the demo login account; 孙海洋 (XJU 学长,
course wiki contributor) signs the imported xju-* notes.

Safe to re-run — drops and recreates all tables before seeding.
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

# nickname is the user-visible handle; cards / note details render it.
# password values land in cleartext in this file on purpose — local-dev only.
USERS: list[dict] = [
    {
        "sid": "20241401231",
        "name": "赵文彪",
        "nickname": "winbeau",
        "password": "@Winbeau0318",
        "bio": "工程速查 + 深度学习环境配置",
        "wechat": None,
        "phone": None,
        "email": None,
    },
    {
        "sid": "20180000001",
        "name": "孙海洋",
        "nickname": "孙海洋",
        "password": "123456",
        "bio": "新疆大学课程笔记 · xju-course-wiki 维护者",
        "wechat": None,
        "phone": None,
        "email": None,
    },
]

NICKNAME_TO_SID: dict[str, str] = {u["nickname"]: u["sid"] for u in USERS}
DEFAULT_USER_SID: str = USERS[0]["sid"]


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
        raise SystemExit(
            f"missing {NOTES_DIR}; run scripts/notion_pull.py + scripts/wrap_frontmatter.py first"
        )

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

    async with AsyncSessionLocal() as session:
        for u in USERS:
            session.add(
                User(
                    sid=u["sid"],
                    name=u["name"],
                    nickname=u["nickname"],
                    avatar=None,
                    bio=u["bio"],
                    wechat=u.get("wechat"),
                    phone=u.get("phone"),
                    email=u.get("email"),
                    password_hash=hash_password(u["password"]),
                )
            )
        await session.flush()

        unknown_authors: set[str] = set()
        for front, body in notes:
            created = front.get("createdAt", "2026-05-09T00:00:00Z")
            if isinstance(created, str):
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            elif isinstance(created, datetime):
                created_dt = created
            else:
                raise ValueError(f"{front.get('slug')}: unrecognized createdAt {created!r}")
            author_nickname = str(front.get("author") or "").strip()
            author_sid = NICKNAME_TO_SID.get(author_nickname, DEFAULT_USER_SID)
            if author_nickname and author_nickname not in NICKNAME_TO_SID:
                unknown_authors.add(author_nickname)
            session.add(
                Note(
                    id=str(front["id"]),
                    title=str(front["title"]),
                    summary=str(front.get("summary", "")),
                    content=body,
                    cover=None,
                    category=str(front.get("category", "tools")),
                    tags=list(front.get("tags") or []),
                    author_sid=author_sid,
                    created_at=created_dt,
                    read_minutes=int(front.get("readMinutes", 1)),
                )
            )
        await session.commit()

    if unknown_authors:
        print(
            f"  ! unknown authors → defaulted to {DEFAULT_USER_SID}: {sorted(unknown_authors)}"
        )

    print(f"seed done: {len(USERS)} users / {len(notes)} notes")
    for u in USERS:
        print(
            f"  user: sid={u['sid']} name={u['name']:<6} nickname={u['nickname']:<8} pw={u['password']}"
        )


if __name__ == "__main__":
    asyncio.run(main())
