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

AUTHOR = {"id": "usr_winbeau", "name": "winbeau"}
_FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def main() -> int:
    items = []
    for path in sorted(NOTES_DIR.glob("*.md")):
        m = _FRONT.match(path.read_text(encoding="utf-8"))
        if not m:
            print(f"  ! {path.name}: no frontmatter, skipped")
            continue
        front = yaml.safe_load(m.group(1)) or {}
        body = m.group(2).lstrip("\n")
        items.append({
            "id": str(front["id"]),
            "title": str(front["title"]),
            "summary": str(front.get("summary", "")),
            "content": body,
            "category": str(front.get("category", "tools")),
            "tags": list(front.get("tags") or []),
            "author": AUTHOR,
            "createdAt": str(front.get("createdAt", "2026-05-09T00:00:00Z")),
            "likes": 0,
            "comments": 0,
            "readMinutes": int(front.get("readMinutes", 1)),
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total_chars = sum(len(n["content"]) for n in items)
    print(f"wrote {OUT}: {len(items)} notes, {OUT.stat().st_size} B (content sum: {total_chars} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
