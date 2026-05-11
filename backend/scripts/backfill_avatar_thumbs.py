"""Generate `avatar_thumb` for users that already had `avatar` set
before the column existed.

Looks the existing avatar file up by its filename inside backend/uploads/avatars/
(the URL stored in the DB ends with that filename), writes a sibling
`*.thumb.jpg`, and updates `users.avatar_thumb`.

Usage:
  uv run python scripts/backfill_avatar_thumbs.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from PIL import UnidentifiedImageError
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import User  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.routes.auth import AVATAR_DIR, _make_thumbnail  # noqa: E402
from app.settings import settings  # noqa: E402


async def main() -> int:
    fixed = 0
    skipped = 0
    failed: list[tuple[str, str]] = []
    async with AsyncSessionLocal() as db:
        users = (
            (await db.execute(select(User).where(User.avatar.is_not(None))))
            .scalars()
            .all()
        )
        for user in users:
            if user.avatar_thumb:
                skipped += 1
                continue
            assert user.avatar is not None
            fname = user.avatar.rsplit("/", 1)[-1]
            src = AVATAR_DIR / fname
            if not src.is_file():
                failed.append((user.sid, f"source file missing: {src}"))
                continue
            stem = fname.rsplit(".", 1)[0]
            thumb_path = AVATAR_DIR / f"{stem}.thumb.jpg"
            try:
                _make_thumbnail(src.read_bytes(), thumb_path)
            except (UnidentifiedImageError, OSError) as e:
                failed.append((user.sid, str(e)))
                continue
            user.avatar_thumb = (
                f"{settings.public_base_url}/uploads/avatars/{thumb_path.name}"
            )
            fixed += 1
        await db.commit()

    print(f"fixed: {fixed}, already-had-thumb: {skipped}, failed: {len(failed)}")
    for sid, reason in failed:
        print(f"  ! {sid}: {reason}")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
