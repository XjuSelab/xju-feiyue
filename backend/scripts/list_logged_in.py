"""List users whose sid starts with a given prefix and who have logged in.

Usage:

    uv run python scripts/list_logged_in.py 2023
    uv run python scripts/list_logged_in.py 202314
"""
from __future__ import annotations

import argparse
import asyncio
import sys
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

    print(f"{'sid':<12}  {'name':<10}  {'logins':>6}  last")
    print(f"{'-' * 12}  {'-' * 10}  {'-' * 6}  {'-' * 19}")
    for sid, name, logins, last in rows:
        last_s = last.strftime("%Y-%m-%d %H:%M:%S") if last else ""
        print(f"{sid:<12}  {name:<10}  {logins:>6}  {last_s}")
    return 0


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="列出 sid 以某前缀开头、且登录过的账号")
    p.add_argument("prefix", help="sid 前缀，例如 2023 / 202314")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    sys.exit(asyncio.run(_list(args.prefix.strip())))
