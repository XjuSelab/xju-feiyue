"""Add or refresh a user — idempotent upsert with default password.

Usage:

    # interactive (asks for 学号 / 姓名)
    uv run python scripts/add_user.py

    # one-shot via CLI args
    uv run python scripts/add_user.py --sid 20241401230 --name 梁家祥

    # batch: read "sid,name" pairs from a file or stdin
    uv run python scripts/add_user.py --batch users.csv
    uv run python scripts/add_user.py --batch -  <<EOF
    20241401230,梁家祥
    20241401234,李卓言
    EOF

If a user with the given sid already exists, name / nickname are
refreshed; the password is left untouched so re-runs don't reset it.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.models import User  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.services.auth import hash_password  # noqa: E402

DEFAULT_PASSWORD = "123456"


def _validate(sid: str, name: str) -> tuple[str, str]:
    sid = sid.strip()
    name = name.strip()
    if not sid or not name:
        raise ValueError("sid 和 姓名都不能为空")
    if len(sid) > 11:
        raise ValueError(f"sid '{sid}' 超过 11 位")
    return sid, name


async def _upsert(sid: str, name: str, password: str) -> str:
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(select(User).where(User.sid == sid))
        if existing:
            old = existing.nickname
            existing.name = name
            existing.nickname = name
            await session.commit()
            return f"update  sid={sid}  {old!r} → {name!r}  (密码未改)"
        session.add(
            User(
                sid=sid,
                name=name,
                nickname=name,
                avatar=None,
                avatar_thumb=None,
                bio=None,
                wechat=None,
                phone=None,
                email=None,
                password_hash=hash_password(password),
            )
        )
        await session.commit()
        return f"insert  sid={sid}  name={name}  pw={password}"


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="新增 / 刷新一个学生账号")
    p.add_argument("--sid", "-s", help="11 位学号")
    p.add_argument("--name", "-n", help="姓名（同时作为 nickname）")
    p.add_argument(
        "--password",
        "-p",
        default=DEFAULT_PASSWORD,
        help=f"初始密码（默认 {DEFAULT_PASSWORD}，已存在的用户不会被改）",
    )
    p.add_argument(
        "--batch",
        metavar="FILE",
        help='从文件读取 "sid,name" 一行一对；用 "-" 表示 stdin',
    )
    return p.parse_args()


def _read_pairs(source: str) -> list[tuple[str, str]]:
    fh = sys.stdin if source == "-" else open(source, encoding="utf-8")
    out: list[tuple[str, str]] = []
    try:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",", 1)]
            if len(parts) != 2:
                print(f"  ! 跳过无效行: {line!r}", file=sys.stderr)
                continue
            out.append((parts[0], parts[1]))
    finally:
        if fh is not sys.stdin:
            fh.close()
    return out


async def _run() -> int:
    args = _parse_args()

    if args.batch:
        pairs = _read_pairs(args.batch)
    elif args.sid and args.name:
        pairs = [(args.sid, args.name)]
    else:
        sid = args.sid or input("学号 sid: ")
        name = args.name or input("姓名 name: ")
        pairs = [(sid, name)]

    if not pairs:
        print("没有要导入的用户", file=sys.stderr)
        return 1

    rc = 0
    for sid, name in pairs:
        try:
            sid, name = _validate(sid, name)
            print(await _upsert(sid, name, args.password))
        except Exception as e:
            print(f"  ! {sid} {name}: {e}", file=sys.stderr)
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(asyncio.run(_run()))
