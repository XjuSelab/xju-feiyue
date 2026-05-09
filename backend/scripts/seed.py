"""Seed the DB from frontend/src/api/mock/notes.json.

Creates one user per distinct author in the JSON (currently only `winbeau`,
sid `20211010001`, password `123456`) + every note in the file. Safe to
re-run — drops and recreates all tables before seeding.
"""
from __future__ import annotations

import asyncio
import json
import random
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

# Allow `uv run python scripts/seed.py` from the backend/ dir.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import models  # noqa: E402,F401 - register on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.models import Comment, Like, Note, User  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.services.auth import hash_password  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
NOTES_JSON = REPO_ROOT / "frontend/src/api/mock/notes.json"

DEMO_PASSWORD = "123456"

# Map each mock author id → 11-digit student id. `usr_winbeau` is the
# canonical demo account documented in BACKEND_SPEC.md and shown in the
# login page footer.
SID_BY_AUTHOR: dict[str, str] = {
    "usr_winbeau": "20211010001",
}

SAMPLE_COMMENTS = [
    "感谢分享，受益匪浅。",
    "这个细节我之前确实没注意到。",
    "请问 fold 数怎么定的？",
    "收藏了，下次比赛拿来抄作业。",
    "CV-LB 一致性这一段写得很好。",
    "我之前也踩过这个坑，握爪。",
    "可以再展开讲讲超参的选取逻辑吗？",
]


def _scale_likes(mock_likes: int, n_users: int) -> int:
    """Map mock likes (0-312) into [1, n_users] preserving rough ordering."""
    if mock_likes <= 0:
        return 0
    return min(n_users, max(1, round(mock_likes / 70) + 1))


def _scale_comments(mock_comments: int, n_users: int) -> int:
    """Map mock comments (0-78) into [0, min(n_users, 3)]."""
    if mock_comments <= 0:
        return 0
    return min(n_users, 3, max(1, mock_comments // 25))


async def main() -> None:
    raw = json.loads(NOTES_JSON.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("expected notes.json to be a list")

    # Reset schema (dev-only; prod must use alembic).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    pwd_hash = hash_password(DEMO_PASSWORD)

    async with AsyncSessionLocal() as session:
        unique_authors: dict[str, dict[str, str | None]] = {}
        for n in raw:
            a = n["author"]
            if a["id"] not in unique_authors:
                unique_authors[a["id"]] = {
                    "id": a["id"],
                    "name": a["name"],
                    "avatar": a.get("avatar"),
                }

        for uid, data in unique_authors.items():
            sid = SID_BY_AUTHOR.get(uid)
            if not sid:
                # Fallback for unmapped author — pad to 11 digits using a hash.
                sid = f"20211{uid[-6:].rjust(6, '0')}"[:11]
            session.add(
                User(
                    id=uid,
                    sid=sid,
                    name=str(data["name"]),
                    avatar=data["avatar"],
                    bio=("工程速查 + 深度学习环境配置" if uid == "usr_winbeau" else None),
                    password_hash=pwd_hash,
                )
            )
        await session.flush()

        for n in raw:
            session.add(
                Note(
                    id=n["id"],
                    title=n["title"],
                    summary=n["summary"],
                    content=n.get("content", ""),
                    cover=n.get("cover"),
                    category=n["category"],
                    tags=list(n.get("tags", [])),
                    author_id=n["author"]["id"],
                    created_at=datetime.fromisoformat(
                        n["createdAt"].replace("Z", "+00:00")
                    ),
                    read_minutes=int(n.get("readMinutes", 5)),
                )
            )
        await session.flush()

        user_ids = list(unique_authors.keys())
        rng = random.Random(42)

        likes_total = 0
        comments_total = 0
        for n in raw:
            likers = rng.sample(
                user_ids, _scale_likes(int(n.get("likes", 0)), len(user_ids))
            )
            for u in likers:
                session.add(Like(note_id=n["id"], user_id=u))
                likes_total += 1

            commenters = rng.sample(
                user_ids, _scale_comments(int(n.get("comments", 0)), len(user_ids))
            )
            for u in commenters:
                session.add(
                    Comment(
                        id=str(uuid4()),
                        note_id=n["id"],
                        author_id=u,
                        content=rng.choice(SAMPLE_COMMENTS),
                    )
                )
                comments_total += 1

        await session.commit()

    print(f"seed done: {len(unique_authors)} users / {len(raw)} notes")
    print(f"          {likes_total} likes / {comments_total} comments")
    print(f"demo: sid=20211010001 / password={DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
