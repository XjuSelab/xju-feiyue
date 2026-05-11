"""CLI: verify (and optionally repair) author alignment between
`content/notes/*.md` frontmatter and `notes.author_sid` in the DB.

Usage:
  uv run python scripts/sync_authors.py            # dry-run scan (exit 1 if drift)
  uv run python scripts/sync_authors.py --fix      # apply repairs
  uv run python scripts/sync_authors.py --json     # machine-readable scan output

The same logic runs daily inside the FastAPI app (see app/main.py
lifespan), but the CLI is handy for ops-time spot-checks and tests.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.services.author_sync import SyncReport, repair, scan  # noqa: E402


def _format_human(report: SyncReport, *, fixed: bool) -> str:
    lines = [
        f"checked: {report.checked} notes",
        f"aligned: {report.aligned}",
        f"mismatches: {len(report.mismatches)} ({len(report.fixable)} fixable, "
        f"{len(report.unresolvable)} unresolvable)",
        f"md-orphans (no DB row): {len(report.md_orphans)}",
        f"db-only (no MD file): {len(report.db_only)}",
    ]
    if report.mismatches:
        lines.append("")
        lines.append("  id                                | current → expected           | reason")
        for m in report.mismatches:
            cur = f"{m.current_nickname}({m.current_sid})"
            exp_sid = m.expected_sid or "?"
            exp = f"{m.expected_nickname}({exp_sid})"
            lines.append(f"  {m.note_id:<34} | {cur} → {exp}".ljust(72) + f" | {m.reason}")
    if fixed:
        lines.append("")
        lines.append(f"repaired {len(report.fixable)} note(s)")
    return "\n".join(lines)


async def _amain(*, fix: bool, as_json: bool) -> int:
    async with AsyncSessionLocal() as db:
        report = await (repair(db) if fix else scan(db))

    if as_json:
        payload = {
            "checked": report.checked,
            "aligned": report.aligned,
            "fixed": fix,
            "mismatches": [asdict(m) for m in report.mismatches],
            "md_orphans": report.md_orphans,
            "db_only": report.db_only,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(_format_human(report, fixed=fix))

    # Dry-run with any drift → non-zero exit so CI / cron can alert.
    if not fix and report.mismatches:
        return 1
    # Repair that left unresolvable items behind → non-zero too.
    if fix and report.unresolvable:
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fix", action="store_true", help="apply repairs (default: dry-run)")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = parser.parse_args()
    return asyncio.run(_amain(fix=args.fix, as_json=args.json))


if __name__ == "__main__":
    raise SystemExit(main())
