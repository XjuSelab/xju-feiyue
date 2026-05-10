"""Clone (or fast-forward) the upstream xju-course-wiki repo into
scripts/xju_wiki_raw/ and write _index.json for the 17 course folders we want
to import into LabNotes.

Source: https://github.com/SunSeaLucky/xju-course-wiki (孙海洋 学长 的 XJU 课程 wiki)

Output:
  scripts/xju_wiki_raw/.git/ + docs/...   shallow clone (gitignored)
  scripts/xju_wiki_raw/_index.json        slug ↔ title ↔ subpages ↔ ts

Run with:
  uv run --project scripts/sync python scripts/xju_pull.py
(re-uses scripts/sync's venv just because it has Python; this script only
 shells out to git + writes JSON.)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "xju_wiki_raw"
INDEX_PATH = RAW_DIR / "_index.json"

UPSTREAM = "https://github.com/SunSeaLucky/xju-course-wiki.git"

# (slug, title, nav_section, [subpage relative paths])
# subpage order = how they will be concatenated in the final note.
COURSES: list[tuple[str, str, str, list[str]]] = [
    ("algorithm",                          "算法设计与分析",      "理论课程",       ["intro/main.md", "note/main.md"]),
    ("android-dev",                        "Android 开发",          "编程/数据/开发", ["intro/main.md", "note/main.md"]),
    ("assembly-language",                  "汇编语言程序设计",    "编程/数据/开发", ["intro/main.md", "note/main.md"]),
    ("circuits-analog-electronics",        "电路与模电",            "硬件与信号",     ["intro/main.md"]),
    ("compile-theory",                     "编译原理",              "理论课程",       ["intro/main.md", "note/main.md"]),
    ("computer-operating-system",          "计算机操作系统",        "408 课程",       ["intro/main.md", "note/main.md", "lab/main.md"]),
    ("database",                           "数据库（PostgreSQL）",  "编程/数据/开发", ["intro/main.md", "note/main.md", "note/my-main.md", "experiment/main.md", "experiment/code.md"]),
    ("discrete-math",                      "离散数学",              "理论基础课",     ["intro/main.md", "note/main.md"]),
    ("emb-linux",                          "嵌入式 Linux",          "编程/数据/开发", ["intro/main.md", "note/main.md"]),
    ("linear-algebra",                     "线性代数",              "理论基础课",     ["intro/main.md", "note/main.md"]),
    ("linux",                              "Linux",                 "编程/数据/开发", ["intro/main.md", "note/main.md", "lab/main.md"]),
    ("mao-mind",                           "毛泽东思想和中国特色社会主义理论体系概论", "通识必修课", ["intro/main.md", "note/main.md", "note/important.md", "note/temp.md"]),
    ("principles-of-computer-composition", "计算机组成原理",        "408 课程",       ["intro/main.md", "note/main.md"]),
    ("python",                             "Python",                "编程/数据/开发", ["intro/main.md", "note/main.md"]),
    ("signal-analysis",                    "信号与系统分析基础",    "硬件与信号",     ["intro/main.md", "note/main.md"]),
    ("software-engineering",               "软件工程",              "理论课程",       ["intro/main.md", "note/main.md", "pre/main.md"]),
    ("xi-mind",                            "习近平新时代中国特色社会主义思想概论", "通识必修课", ["intro/main.md", "note/main.md"]),
]


def run(cmd: list[str], cwd: Path | None = None) -> str:
    return subprocess.run(
        cmd, cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8"
    ).stdout.strip()


def ensure_clone() -> None:
    git_dir = RAW_DIR / ".git"
    if git_dir.is_dir():
        print(f"[pull] {RAW_DIR.relative_to(REPO_ROOT)} exists, fast-forward …")
        try:
            run(["git", "fetch", "--depth", "1", "origin", "main"], cwd=RAW_DIR)
            run(["git", "reset", "--hard", "origin/main"], cwd=RAW_DIR)
        except subprocess.CalledProcessError as e:
            print(f"  ! git fetch/reset failed: {e.stderr}", file=sys.stderr)
            raise
    else:
        RAW_DIR.parent.mkdir(parents=True, exist_ok=True)
        print(f"[clone] {UPSTREAM} → {RAW_DIR.relative_to(REPO_ROOT)}")
        run(["git", "clone", "--depth", "1", UPSTREAM, str(RAW_DIR)])


def last_commit_iso(folder: Path) -> str | None:
    """ISO-8601 commit-time of the most recent commit touching `folder`.
    Returns None when git has no record (e.g. only-just-added file)."""
    try:
        out = run(
            [
                "git",
                "log",
                "-1",
                "--format=%cI",
                "--",
                str(folder.relative_to(RAW_DIR)),
            ],
            cwd=RAW_DIR,
        )
        return out or None
    except subprocess.CalledProcessError:
        return None


def main() -> int:
    ensure_clone()

    docs = RAW_DIR / "docs"
    if not docs.is_dir():
        raise SystemExit(f"docs/ missing in {RAW_DIR}")

    index: list[dict] = []
    missing: list[str] = []
    for slug, title, nav, subpaths in COURSES:
        course_dir = docs / slug
        if not course_dir.is_dir():
            missing.append(slug)
            continue
        existing = []
        for p in subpaths:
            full = course_dir / p
            if full.is_file():
                existing.append(p)
            else:
                print(f"  ! {slug}: subpage missing → {p}")
        if not existing:
            missing.append(slug)
            continue
        index.append(
            {
                "slug": slug,
                "title": title,
                "nav_section": nav,
                "subpages": existing,
                "last_commit": last_commit_iso(course_dir),
            }
        )

    if missing:
        print(f"[warn] {len(missing)} courses missing on upstream: {missing}")

    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[ok] wrote {INDEX_PATH.relative_to(REPO_ROOT)}: {len(index)} courses")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
