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

    # roster import with 班级 assignment (applies to every row; the class
    # row is get-or-created by short_name, full_name refreshed if changed)
    uv run python scripts/add_user.py --batch scripts/roster_cs24-3.csv \
        --class-full 计算机科学与技术24-3 --class-short 计算机24-3

If a user with the given sid already exists, name / nickname are
refreshed; the password is left untouched so re-runs don't reset it.
When --class-full/--class-short are given the class is stamped on both
insert *and* refresh.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.models import StudentClass, User  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.services.auth import hash_password  # noqa: E402
from app.services.greeting import familiar_name  # noqa: E402

DEFAULT_PASSWORD = "123456"


async def _get_or_create_class(full_name: str, short_name: str) -> int:
    """The class id for (full, short) — matched by short_name, full refreshed."""
    async with AsyncSessionLocal() as session:
        clazz = await session.scalar(
            select(StudentClass).where(StudentClass.short_name == short_name)
        )
        if clazz is None:
            clazz = StudentClass(full_name=full_name, short_name=short_name)
            session.add(clazz)
            await session.commit()
            await session.refresh(clazz)
            print(f"class   id={clazz.id}  {full_name} / {short_name}  (新建)")
        elif clazz.full_name != full_name:
            old = clazz.full_name
            clazz.full_name = full_name
            await session.commit()
            print(f"class   id={clazz.id}  全名 {old!r} → {full_name!r}")
        return clazz.id


def _validate(sid: str, name: str) -> tuple[str, str]:
    sid = sid.strip()
    name = name.strip()
    if not sid or not name:
        raise ValueError("sid 和 姓名都不能为空")
    if len(sid) > 11:
        raise ValueError(f"sid '{sid}' 超过 11 位")
    return sid, name


async def _upsert(
    sid: str,
    name: str,
    password: str,
    preferred: str | None = None,
    class_id: int | None = None,
) -> str:
    # Greeting form-of-address: explicit --preferred-name wins, else derive
    # from the legal name (interpunct/length rules, same as the greeting svc).
    preferred_name = (preferred or "").strip() or familiar_name(name)
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(select(User).where(User.sid == sid))
        if existing:
            old = existing.nickname
            existing.name = name
            existing.nickname = name
            # Keep the greeting address in sync with the (possibly new) name.
            existing.preferred_name = preferred_name
            if class_id is not None:
                existing.class_id = class_id
            await session.commit()
            return f"update  sid={sid}  {old!r} → {name!r}  (密码未改)"
        session.add(
            User(
                sid=sid,
                name=name,
                nickname=name,
                preferred_name=preferred_name,
                avatar=None,
                avatar_thumb=None,
                bio=None,
                wechat=None,
                phone=None,
                email=None,
                password_hash=hash_password(password),
                class_id=class_id,
            )
        )
        await session.commit()
        return f"insert  sid={sid}  name={name}  pw={password}"


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="新增 / 刷新一个学生账号")
    p.add_argument("--sid", "-s", help="11 位学号")
    p.add_argument("--name", "-n", help="姓名（同时作为 nickname）")
    p.add_argument(
        "--preferred-name",
        help="问候称呼,默认按真名派生 (仅作用于单条 CLI, 批量恒派生)",
    )
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
    p.add_argument(
        "--class-full",
        help="班级全名（如 计算机科学与技术24-3）；须与 --class-short 同时给",
    )
    p.add_argument(
        "--class-short",
        help="班级简名（如 计算机24-3）；作用于本次导入的所有用户",
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

    # --preferred-name only applies to the single/CLI path; batch rows always
    # derive the address from each name (no per-row override syntax).
    preferred = None
    if args.batch:
        pairs = _read_pairs(args.batch)
    elif args.sid and args.name:
        pairs = [(args.sid, args.name)]
        preferred = args.preferred_name
    else:
        sid = args.sid or input("学号 sid: ")
        name = args.name or input("姓名 name: ")
        pairs = [(sid, name)]
        preferred = args.preferred_name

    if not pairs:
        print("没有要导入的用户", file=sys.stderr)
        return 1

    if bool(args.class_full) != bool(args.class_short):
        print("--class-full 和 --class-short 必须同时给出", file=sys.stderr)
        return 1
    class_id: int | None = None
    if args.class_full and args.class_short:
        class_id = await _get_or_create_class(
            args.class_full.strip(), args.class_short.strip()
        )

    rc = 0
    for sid, name in pairs:
        try:
            sid, name = _validate(sid, name)
            print(await _upsert(sid, name, args.password, preferred, class_id))
        except Exception as e:
            print(f"  ! {sid} {name}: {e}", file=sys.stderr)
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(asyncio.run(_run()))
