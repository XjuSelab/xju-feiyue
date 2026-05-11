"""Walk content/notes/*.md and write frontend/src/api/mock/notes.json.

Mock JSON shape mirrors what `seed.py` produces in the DB so dev mode
(VITE_API_BASE unset) and real-backend mode are visually identical.

Run after edits to content/notes/.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = REPO_ROOT / "content" / "notes"
OUT = REPO_ROOT / "frontend" / "src" / "api" / "mock" / "notes.json"

# Frontmatter `author` (nickname) → mock author shape sent to the
# frontend. Keep sids in lock-step with backend/scripts/seed.py USERS.
AUTHOR_MAP: dict[str, dict] = {
    "winbeau": {"sid": "20241401231", "nickname": "winbeau"},
    "孙海洋":   {"sid": "20180000001", "nickname": "孙海洋"},
}
DEFAULT_AUTHOR = AUTHOR_MAP["winbeau"]
_FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def main() -> int:
    items = []
    unknown: set[str] = set()
    for path in sorted(NOTES_DIR.glob("*.md")):
        m = _FRONT.match(path.read_text(encoding="utf-8"))
        if not m:
            print(f"  ! {path.name}: no frontmatter, skipped")
            continue
        front = yaml.safe_load(m.group(1)) or {}
        body = m.group(2).lstrip("\n")
        author_name = str(front.get("author") or "").strip()
        author = AUTHOR_MAP.get(author_name, DEFAULT_AUTHOR)
        if author_name and author_name not in AUTHOR_MAP:
            unknown.add(author_name)
        items.append({
            "id": str(front["id"]),
            "title": str(front["title"]),
            "summary": str(front.get("summary", "")),
            "content": body,
            "category": str(front.get("category", "tools")),
            "tags": list(front.get("tags") or []),
            "author": author,
            "createdAt": str(front.get("createdAt", "2026-05-09T00:00:00Z")),
            "likes": 0,
            "comments": 0,
            "readMinutes": int(front.get("readMinutes", 1)),
        })

    if unknown:
        print(f"  ! unknown authors → defaulted to {DEFAULT_AUTHOR['nickname']}: {sorted(unknown)}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total_chars = sum(len(n["content"]) for n in items)
    print(f"wrote {OUT}: {len(items)} notes, {OUT.stat().st_size} B (content sum: {total_chars} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
