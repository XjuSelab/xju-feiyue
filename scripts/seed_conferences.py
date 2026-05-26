#!/usr/bin/env python3
"""Seed the CCF conferences reference data from the design-ref data file.

Single source → two emits (mirrors the schools data pipeline, but here *we*
are the producer because the R3 crawler isn't live yet):

  archive/design-refs/components/conferences-data.jsx   (the one source)
        │
        ├─▶ backend/data/conferences/conferences.sqlite  (read-only service DB)
        │   backend/data/conferences/manifest.json       (sha256 + counts)
        │
        └─▶ frontend/src/features/conferences/data.ts     (typed CCF_FIELDS + CCF_CONFS)

The .jsx is plain JS (no JSX tags), so we evaluate it with Node's `vm` to get
the exact same `CCF_FIELDS` / `CCF_CONFS` the browser mock used — no brittle
regex parsing, no drift. Node ships with the frontend toolchain.

`crawl_state` / `next_check_at` are derived from each `deadline` at seed time
(the same 3-state machine the crawler will maintain):

    deadline = null          → unannounced  (crawler checks daily)
    deadline < today         → closed        (crawler stops until Jan 1 reset)
    deadline >= today        → announced     (crawler re-checks every 5 days)

Usage:
    python3 scripts/seed_conferences.py            # regenerate all artifacts
    python3 scripts/seed_conferences.py --check     # print counts, don't write

After regenerating, run `npx prettier --write` on the emitted data.ts (or
`pnpm format`) so it matches the repo's formatting. Re-run is idempotent.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
JSX_PATH = REPO_ROOT / "archive" / "design-refs" / "components" / "conferences-data.jsx"
DATA_DIR = REPO_ROOT / "backend" / "data" / "conferences"
SQLITE_PATH = DATA_DIR / "conferences.sqlite"
MANIFEST_PATH = DATA_DIR / "manifest.json"
DATA_TS_PATH = REPO_ROOT / "frontend" / "src" / "features" / "conferences" / "data.ts"

SCHEMA_VERSION = 1
SEED_VERSION = "seed-0.1.0"

# Columns persisted to sqlite, in stable insertion order. The first 13 are the
# display fields the .jsx already carries; the rest are the crawler's state.
SEED_FIELDS = (
    "id",
    "abbr",
    "name_full",
    "field",
    "tier",
    "publisher",
    "dblp",
    "homepage",
    "cycle",
    "location",
    "conf_date",
    "deadline",
    "note",
)

CREATE_TABLE = """
CREATE TABLE conferences (
    id            TEXT PRIMARY KEY,
    abbr          TEXT NOT NULL,
    name_full     TEXT NOT NULL,
    field         TEXT NOT NULL,
    tier          TEXT NOT NULL,
    publisher     TEXT,
    dblp          TEXT,
    homepage      TEXT,
    cycle         TEXT,
    location      TEXT,
    conf_date     TEXT,
    deadline      TEXT,        -- ISO yyyy-mm-dd, or NULL when unannounced
    note          TEXT,
    crawl_state   TEXT NOT NULL,   -- unannounced | announced | closed
    confidence    REAL,            -- crawler's confidence (NULL for human seed)
    source_url    TEXT,            -- where the crawler verified it
    last_checked_at TEXT,          -- ISO; NULL = never crawled
    next_check_at TEXT,            -- ISO; NULL = not scheduled (closed)
    target_year   INTEGER          -- cycle this row tracks
);
"""

CREATE_INDEXES = (
    # The crawler selects rows due for a check: crawl_state != 'closed' AND
    # next_check_at <= now.
    "CREATE INDEX idx_conf_schedule ON conferences (crawl_state, next_check_at);",
    "CREATE INDEX idx_conf_field ON conferences (field, tier);",
)


def eval_jsx(jsx_path: Path) -> dict:
    """Run the plain-JS data file through Node and return {fields, confs}."""
    node = shutil.which("node")
    if not node:
        sys.exit("✗ node not found on PATH — needed to evaluate the .jsx data source")
    evaluator = (
        "const fs=require('fs');const vm=require('vm');"
        "const src=fs.readFileSync(process.argv[1],'utf8');"
        "const ctx={window:{},console};vm.createContext(ctx);"
        "vm.runInContext(src,ctx,{filename:'conferences-data.jsx'});"
        "process.stdout.write(JSON.stringify("
        "{fields:ctx.window.CCF_FIELDS,confs:ctx.window.CCF_CONFS}));"
    )
    out = subprocess.run(
        [node, "-e", evaluator, str(jsx_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(out.stdout)
    if not data.get("fields") or not data.get("confs"):
        sys.exit("✗ .jsx evaluated but CCF_FIELDS / CCF_CONFS came back empty")
    return data


def derive_state(deadline: str | None, today: date) -> str:
    if not deadline:
        return "unannounced"
    if date.fromisoformat(deadline) < today:
        return "closed"
    return "announced"


def build_sqlite(confs: list[dict], today: date, now_iso: str, dst: Path) -> None:
    """Build the sqlite file at a temp path then atomically move it into place."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".conferences.", suffix=".sqlite", dir=DATA_DIR)
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        conn = sqlite3.connect(tmp_path)
        try:
            conn.execute(CREATE_TABLE)
            for stmt in CREATE_INDEXES:
                conn.execute(stmt)
            cols = SEED_FIELDS + (
                "crawl_state",
                "confidence",
                "source_url",
                "last_checked_at",
                "next_check_at",
                "target_year",
            )
            placeholders = ", ".join("?" for _ in cols)
            insert = f"INSERT INTO conferences ({', '.join(cols)}) VALUES ({placeholders})"
            for c in confs:
                deadline = c.get("deadline")
                state = derive_state(deadline, today)
                cycle = c.get("cycle")
                target_year = int(cycle) if (cycle and str(cycle).isdigit()) else None
                row = [c.get(f) for f in SEED_FIELDS]
                row += [
                    state,
                    None,  # confidence — set by the crawler, not the seed
                    None,  # source_url — set by the crawler
                    None,  # last_checked_at — never crawled yet
                    None if state == "closed" else now_iso,  # next_check_at
                    target_year,
                ]
                conn.execute(insert, row)
            conn.commit()
        finally:
            conn.close()
        os.replace(tmp_path, dst)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def write_manifest(confs: list[dict], fields: list[dict], now_iso: str) -> None:
    raw = SQLITE_PATH.read_bytes()
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "exported_at": now_iso,
        "claw_version": SEED_VERSION,
        "conferences_sqlite_sha256": hashlib.sha256(raw).hexdigest(),
        "conferences_sqlite_bytes": len(raw),
        "counts": {"conferences": len(confs), "fields": len(fields)},
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")


def js_str(value) -> str:
    if value is None:
        return "null"
    s = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"


def write_data_ts(confs: list[dict], fields: list[dict]) -> None:
    lines: list[str] = [
        "/**",
        " * AUTO-GENERATED — do not edit by hand.",
        " * Source:     archive/design-refs/components/conferences-data.jsx",
        " * Regenerate: python3 scripts/seed_conferences.py (then `pnpm format`)",
        " *",
        " * 230 个 CCF 推荐会议（《CCF 推荐国际学术会议和期刊目录》第七版）。",
        " * deadline / location 等动态字段为人工整理的种子，R3 爬虫上线后成为真值源。",
        " */",
        "import type { CcfField, Conference } from './types'",
        "",
        "export const CCF_FIELDS: CcfField[] = [",
    ]
    for f in fields:
        lines.append(
            "  { "
            f"id: {js_str(f['id'])}, name_cn: {js_str(f['name_cn'])}, "
            f"short: {js_str(f['short'])}, color: {js_str(f['color'])} "
            "},"
        )
    lines += ["]", "", "export const CCF_CONFS: Conference[] = ["]
    for c in confs:
        parts = ", ".join(f"{f}: {js_str(c.get(f))}" for f in SEED_FIELDS)
        lines.append(f"  {{ {parts} }},")
    lines += ["]", ""]
    DATA_TS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_TS_PATH.write_text("\n".join(lines), "utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="seed_conferences")
    p.add_argument("--check", action="store_true", help="parse + report counts, don't write")
    args = p.parse_args(argv)

    data = eval_jsx(JSX_PATH)
    fields: list[dict] = data["fields"]
    confs: list[dict] = data["confs"]

    by_tier: dict[str, int] = {}
    for c in confs:
        by_tier[c["tier"]] = by_tier.get(c["tier"], 0) + 1
    print(f"parsed {len(confs)} conferences, {len(fields)} fields "
          f"(A={by_tier.get('A', 0)} B={by_tier.get('B', 0)} C={by_tier.get('C', 0)})")

    if args.check:
        return 0

    today = date.today()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    build_sqlite(confs, today, now_iso, SQLITE_PATH)
    write_manifest(confs, fields, now_iso)
    write_data_ts(confs, fields)

    print(f"✓ wrote {SQLITE_PATH.relative_to(REPO_ROOT)} "
          f"({SQLITE_PATH.stat().st_size} bytes)")
    print(f"✓ wrote {MANIFEST_PATH.relative_to(REPO_ROOT)}")
    print(f"✓ wrote {DATA_TS_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
