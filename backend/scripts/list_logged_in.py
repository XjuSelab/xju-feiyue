"""List users whose sid starts with a given prefix and who have logged in.

Usage:

    uv run python scripts/list_logged_in.py 2023
    uv run python scripts/list_logged_in.py 202314
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.db.models import LoginEvent, User  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402


async def _list(prefix: str) -> int:
    stmt = (
        select(
            User.sid,
            User.name,
            func.count(LoginEvent.id).label("logins"),
            func.max(LoginEvent.created_at).label("last"),
        )
        .join(LoginEvent, LoginEvent.user_sid == User.sid)
        .where(User.sid.like(f"{prefix}%"))
        .group_by(User.sid)
        .order_by(func.max(LoginEvent.created_at).desc())
    )
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(stmt)).all()

    if not rows:
        print(f"(no logged-in users with sid starting '{prefix}')")
        return 0

    data = [
        (sid, name, str(logins), last.strftime("%Y-%m-%d %H:%M:%S") if last else "")
        for sid, name, logins, last in rows
    ]
    _print_table(("sid", "name", "logins", "last"), data, aligns=("<", "<", ">", "<"))
    return 0


def _dw(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in ("W", "F") else 1 for c in s)


def _pad(s: str, width: int, align: str) -> str:
    extra = width - _dw(s)
    if extra <= 0:
        return s
    return (s + " " * extra) if align == "<" else (" " * extra + s)


def _print_table(headers, rows, aligns):
    widths = [
        max(_dw(h), *(_dw(r[i]) for r in rows)) for i, h in enumerate(headers)
    ]
    sep = "  "
    print(sep.join(_pad(h, w, a) for h, w, a in zip(headers, widths, aligns)))
    print(sep.join("-" * w for w in widths))
    for row in rows:
        print(sep.join(_pad(c, w, a) for c, w, a in zip(row, widths, aligns)))


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="列出 sid 以某前缀开头、且登录过的账号")
    p.add_argument("prefix", help="sid 前缀，例如 2023 / 202314")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    sys.exit(asyncio.run(_list(args.prefix.strip())))
