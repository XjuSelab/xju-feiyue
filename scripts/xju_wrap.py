"""Read scripts/xju_wiki_raw/_bodies/<slug>.body.md + _index.json and write
content/notes/xju-<slug>.md (markdown body + LabNotes YAML frontmatter).

Author: 孙海洋 (XJU 学长). Categorized as `course`. nav-section + course
keyword become the primary tags.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from wrap_frontmatter import (
    build_frontmatter,
    derive_read_minutes,
    derive_summary,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "xju_wiki_raw"
BODIES_DIR = RAW_DIR / "_bodies"
INDEX_PATH = RAW_DIR / "_index.json"
NOTES_DIR = REPO_ROOT / "content" / "notes"

UPSTREAM_TREE = "https://github.com/SunSeaLucky/xju-course-wiki/tree/main/docs"

# nav_section (raw value in _index.json) → short tag label
NAV_TAG = {
    "理论基础课":     "理论基础",
    "通识必修课":     "通识",
    "编程/数据/开发": "编程",
    "408 课程":       "408",
    "理论课程":       "理论",
    "硬件与信号":     "硬件",
}

# course slug → primary subject tag (added before nav tag for sharper cards)
COURSE_KEYWORD_TAG = {
    "algorithm":                          "算法",
    "android-dev":                        "Android",
    "assembly-language":                  "汇编",
    "circuits-analog-electronics":        "电路",
    "compile-theory":                     "编译",
    "computer-operating-system":          "操作系统",
    "database":                           "PostgreSQL",
    "discrete-math":                      "离散数学",
    "emb-linux":                          "嵌入式",
    "linear-algebra":                     "线性代数",
    "linux":                              "Linux",
    "mao-mind":                           "毛概",
    "principles-of-computer-composition": "组成原理",
    "python":                             "Python",
    "signal-analysis":                    "信号",
    "software-engineering":               "软件工程",
    "xi-mind":                            "习概",
}


def derive_tags(slug: str, nav_section: str) -> list[str]:
    seen: list[str] = []
    for t in [
        COURSE_KEYWORD_TAG.get(slug, ""),
        NAV_TAG.get(nav_section, nav_section),
        "XJU",
        "新疆大学",
    ]:
        if t and t not in seen:
            seen.append(t)
    return seen[:4]


def offset_iso(base: str, minutes: int) -> str:
    """Subtract `minutes` from an ISO-8601 timestamp, preserving timezone.
    The upstream is a single squashed commit so every course has the same
    raw last_commit ts — we space them out by enumeration index so the
    "latest" feed has a stable, distinguishable order.
    """
    dt = datetime.fromisoformat(base.replace("Z", "+00:00"))
    return (dt - timedelta(minutes=minutes)).isoformat(timespec="seconds")


def main() -> int:
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))

    written = 0
    for i, entry in enumerate(index, start=1):
        slug = entry["slug"]
        body_path = BODIES_DIR / f"{slug}.body.md"
        if not body_path.is_file():
            print(f"  ! {slug}: missing body file, skipped")
            continue
        body = body_path.read_text(encoding="utf-8")
        title = entry["title"]
        nav = entry["nav_section"]
        base_ts = entry.get("last_commit") or "2026-05-09T00:00:00Z"
        front = build_frontmatter({
            "id": f"note_course_sunhaiyang_{i:03d}",
            "slug": f"xju-{slug}",
            "title": title,
            "summary": derive_summary(title, body),
            "category": "course",
            "tags": derive_tags(slug, nav),
            "author": "孙海洋",
            "createdAt": offset_iso(base_ts, i - 1),
            "readMinutes": derive_read_minutes(body),
            "upstream": f"{UPSTREAM_TREE}/{slug}",
        })
        out_path = NOTES_DIR / f"xju-{slug}.md"
        out_path.write_text(front + body.lstrip("\n"), encoding="utf-8")
        written += 1

    print(f"[ok] wrote {written}/{len(index)} files in {NOTES_DIR.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
