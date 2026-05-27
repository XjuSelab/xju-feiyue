"""CCF conference deadline crawler — runs as a backend background task.

Integrated into the API process (like author_sync): reads the conferences
sqlite, checks due rows (next_check_at <= now), fetches each homepage via
httpx, asks DeepSeek v4-flash to extract CFP info, and writes back.

The conferences_engine holder hot-reloads on mtime, so after the crawl
commits and the caller calls force_reload(), the /conferences API serves
fresh data immediately.

Call crawl_sync() from asyncio.to_thread in the background loop; it's
intentionally synchronous (plain httpx + openai + sqlite3) so it doesn't
block the async event loop.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import httpx
from openai import OpenAI

_log = logging.getLogger("xju_feiyue.conf_crawler")

UNANNOUNCED_DAYS = 1
ANNOUNCED_DAYS = 5
FETCH_TIMEOUT = 15
API_MAX_TOKENS = 2000
PAGE_MAX_CHARS = 6000
INTER_CALL_SLEEP = 1.0

SYSTEM_PROMPT = (
    "You extract conference Call-for-Papers information from webpage text. "
    "Return ONLY a valid JSON object, nothing else."
)

USER_PROMPT = """\
Conference: {abbr} ({name_full})
Target edition: {target_year}

Webpage text (may be truncated):
---
{page_text}
---

Extract a JSON object with these fields:
- found: boolean — true if any CFP / deadline info was found
- deadline: string|null — submission deadline as "YYYY-MM-DD"
- cycle: string|null — edition year, e.g. "2027"
- location: string|null — venue, e.g. "Tokyo, Japan"
- conf_date: string|null — dates, e.g. "2027-03-07 ~ 03-11"
- homepage: string|null — canonical conference URL
- confidence: float — 0.0 to 1.0
- note: string|null — brief note
- submissions: integer|null — submission count if mentioned
- accepted: integer|null — accepted count if mentioned
- acceptance_rate: float|null — rate as percentage if mentioned

Only extract what the text explicitly contains. Do not hallucinate dates."""


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in ("script", "style", "noscript", "svg"):
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript", "svg"):
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self._parts.append(data)

    def get_text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self._parts)).strip()


def _fetch_page(url: str) -> str | None:
    try:
        r = httpx.get(
            url, timeout=FETCH_TIMEOUT, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ConfCrawler/0.1)"},
        )
        if r.status_code >= 400:
            return None
        ex = _TextExtractor()
        ex.feed(r.text)
        text = ex.get_text()
        return text[:PAGE_MAX_CHARS] if len(text) >= 50 else None
    except Exception:
        return None


def _ask_deepseek(
    client: OpenAI, model: str, conf: dict, page_text: str,
) -> dict[str, Any] | None:
    prompt = USER_PROMPT.format(
        abbr=conf["abbr"], name_full=conf["name_full"],
        target_year=conf.get("target_year") or date.today().year,
        page_text=page_text,
    )
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=API_MAX_TOKENS,
        )
        raw = resp.choices[0].message.content or ""
        return json.loads(raw) if raw.strip() else None
    except Exception as e:
        _log.warning("DeepSeek error for %s: %s", conf["abbr"], e)
        return None


def _derive_state(deadline: str | None, today: date) -> str:
    if not deadline:
        return "unannounced"
    try:
        return "closed" if date.fromisoformat(deadline) < today else "announced"
    except ValueError:
        return "unannounced"


def _next_check(state: str, now_iso: str) -> str | None:
    if state == "closed":
        return None
    delta = UNANNOUNCED_DAYS if state == "unannounced" else ANNOUNCED_DAYS
    dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00")) + timedelta(days=delta)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def crawl_sync(
    data_dir: Path,
    *,
    api_key: str,
    base_url: str,
    model: str,
    limit: int | None = None,
    dry_run: bool = False,
    full_scan: bool = False,
) -> dict[str, Any]:
    """One crawl cycle (blocking). Returns a summary dict.

    full_scan=True ignores crawl_state/next_check_at and processes ALL rows
    (used for the first deploy to cover all 230 conferences).
    """
    sqlite_path = data_dir / "conferences.sqlite"
    manifest_path = data_dir / "manifest.json"

    if not sqlite_path.exists():
        return {"error": "conferences.sqlite not found", "updated": 0}

    today = date.today()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = sqlite3.connect(sqlite_path)

    cols = ["id", "abbr", "name_full", "field", "tier", "homepage",
            "cycle", "deadline", "crawl_state", "target_year"]
    col_sql = ", ".join(cols)

    if full_scan:
        sql = f"SELECT {col_sql} FROM conferences ORDER BY rowid"
    else:
        sql = (
            f"SELECT {col_sql} FROM conferences "
            "WHERE crawl_state != 'closed' AND next_check_at IS NOT NULL "
            "AND next_check_at <= ? ORDER BY next_check_at ASC"
        )
    if limit:
        sql += f" LIMIT {limit}"

    rows = conn.execute(sql, () if full_scan else (now_iso,)).fetchall()
    due = [dict(zip(cols, r)) for r in rows]

    if not due:
        conn.close()
        return {"due": 0, "updated": 0, "found": 0}

    if dry_run:
        conn.close()
        return {"due": len(due), "dry_run": True, "conferences": [c["abbr"] for c in due]}

    client = OpenAI(base_url=base_url, api_key=api_key)
    updated = 0
    found_count = 0
    results: list[dict] = []

    for c in due:
        abbr = c["abbr"]
        homepage = c.get("homepage")
        page_text = _fetch_page(homepage) if homepage else None

        if not page_text:
            target = c.get("target_year") or today.year + 1
            page_text = (
                f"(No webpage was fetched for {abbr} — {c['name_full']}. "
                f"Based on your training knowledge of this conference, provide "
                f"any reliable info about the {target} edition: submission "
                f"deadline, location, dates, acceptance rate. Set confidence "
                f"based on how certain you are; use found=false only if you "
                f"truly have no information.)"
            )

        extracted = _ask_deepseek(client, model, c, page_text)
        if not extracted:
            time.sleep(INTER_CALL_SLEEP)
            continue

        found = extracted.get("found", False)
        if found:
            deadline = extracted.get("deadline") or c.get("deadline")
            new_state = _derive_state(deadline, today)
            conn.execute(
                """UPDATE conferences SET
                    homepage = COALESCE(?, homepage),
                    cycle = COALESCE(?, cycle),
                    location = COALESCE(?, location),
                    conf_date = COALESCE(?, conf_date),
                    deadline = COALESCE(?, deadline),
                    note = COALESCE(?, note),
                    submissions = COALESCE(?, submissions),
                    accepted = COALESCE(?, accepted),
                    acceptance_rate = COALESCE(?, acceptance_rate),
                    confidence = ?, source_url = ?,
                    crawl_state = ?, last_checked_at = ?, next_check_at = ?
                WHERE id = ?""",
                (
                    extracted.get("homepage"), extracted.get("cycle"),
                    extracted.get("location"), extracted.get("conf_date"),
                    deadline, extracted.get("note"),
                    extracted.get("submissions"), extracted.get("accepted"),
                    extracted.get("acceptance_rate"),
                    extracted.get("confidence"), extracted.get("source_url"),
                    new_state, now_iso, _next_check(new_state, now_iso), c["id"],
                ),
            )
            found_count += 1
            results.append({"abbr": abbr, "deadline": deadline, "state": new_state})
        else:
            conn.execute(
                "UPDATE conferences SET last_checked_at=?, next_check_at=? WHERE id=?",
                (now_iso, _next_check(c["crawl_state"], now_iso), c["id"]),
            )

        updated += 1
        time.sleep(INTER_CALL_SLEEP)

    conn.commit()

    # Rewrite manifest
    raw = sqlite_path.read_bytes()
    count = conn.execute("SELECT COUNT(*) FROM conferences").fetchone()[0]
    conn.close()
    manifest = {
        "schema_version": 1,
        "exported_at": now_iso,
        "claw_version": "crawler-0.1.0",
        "conferences_sqlite_sha256": hashlib.sha256(raw).hexdigest(),
        "conferences_sqlite_bytes": len(raw),
        "counts": {"conferences": count},
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", "utf-8")

    _log.info("conf_crawler: %d checked, %d found new info", updated, found_count)
    return {"due": len(due), "updated": updated, "found": found_count, "results": results}
