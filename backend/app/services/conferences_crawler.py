"""CCF conference deadline crawler — ccfddl.com YAML primary, DDG+DeepSeek fallback.

Primary source: ccfddl.com/conference/allconf.yml (345 confs, community-curated)
              + ccfddl.com/conference/allacc.yml (91 confs, acceptance rates)
Fallback:      DuckDuckGo search → fetch page → DeepSeek v4-flash extraction

Two HTTP requests cover ~95% of our 230 conferences; DeepSeek is only called
for the handful that don't match ccfddl. Atomic-replace sqlite so the backend's
immutable engine hot-reloads on mtime change.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
import sqlite3
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import httpx
import yaml
from openai import OpenAI

_log = logging.getLogger("xju_feiyue.conf_crawler")

CCFDDL_ALLCONF = "https://ccfddl.com/conference/allconf.yml"
CCFDDL_ALLACC = "https://ccfddl.com/conference/allacc.yml"
FETCH_TIMEOUT = 20
API_MAX_TOKENS = 2000
PAGE_MAX_CHARS = 6000
INTER_CALL_SLEEP = 1.0
UNANNOUNCED_DAYS = 1
ANNOUNCED_DAYS = 5


# ── ccfddl YAML helpers ─────────────────────────────────────────────────

def _fetch_yaml(url: str) -> list[dict] | None:
    try:
        r = httpx.get(url, timeout=FETCH_TIMEOUT, follow_redirects=True)
        if r.status_code != 200:
            return None
        return yaml.safe_load(r.text)
    except Exception as e:
        _log.warning("Failed to fetch %s: %s", url, e)
        return None


def _build_ccfddl_index(allconf: list[dict]) -> dict[str, dict]:
    """Index ccfddl conferences by uppercase abbreviation."""
    idx: dict[str, dict] = {}
    for c in allconf:
        key = c.get("title", "").upper().strip()
        if key:
            idx[key] = c
    return idx


def _build_acc_index(allacc: list[dict]) -> dict[str, dict]:
    idx: dict[str, dict] = {}
    for c in allacc:
        key = c.get("title", "").upper().strip()
        if key:
            idx[key] = c
    return idx


# Common abbreviation aliases: our abbr → ccfddl title
_ABBR_ALIASES: dict[str, str] = {
    "S&P": "SP",
    "USENIX-SECURITY": "USS",
    "ACM MM": "MM",
    "IEEE VIS": "VIS",
    "EUROCRYPT": "EUROCRYPT",
    "EURO-PAR": "EURO-PAR",
    "EUROS&P": "EUROSP",
    "FSE": "FSE",  # ambiguous (crypto vs SE)
    "SIGMETRICS": "SIGMETRICS",
}


def _find_ccfddl_match(abbr: str, idx: dict[str, dict]) -> dict | None:
    key = abbr.upper().strip()
    if key in idx:
        return idx[key]
    alias = _ABBR_ALIASES.get(key)
    if alias and alias in idx:
        return idx[alias]
    cleaned = re.sub(r"^(IEEE|ACM|ACM/IEEE|IEEE/ACM)\s+", "", key)
    if cleaned != key and cleaned in idx:
        return idx[cleaned]
    return None


def _pick_latest_conf(ccfddl_entry: dict, target_year: int) -> dict | None:
    """Pick the best conf instance: prefer target_year, else latest with future deadline."""
    confs = ccfddl_entry.get("confs") or []
    if not confs:
        return None
    by_year = {c.get("year"): c for c in confs}
    if target_year in by_year:
        return by_year[target_year]
    if target_year + 1 in by_year:
        return by_year[target_year + 1]
    return confs[-1]


def _extract_deadline(conf_inst: dict) -> str | None:
    """Extract the main submission deadline as ISO date from a ccfddl conf instance."""
    timelines = conf_inst.get("timeline") or []
    if not timelines:
        return None
    # Pick the last timeline entry's deadline (usually the final/main deadline)
    for tl in reversed(timelines):
        dl = tl.get("deadline")
        if dl:
            return dl[:10]  # "2026-07-27 23:59:59" → "2026-07-27"
    return None


def _extract_from_ccfddl(
    ccfddl_entry: dict, acc_entry: dict | None, target_year: int,
) -> dict[str, Any] | None:
    """Extract structured data from a ccfddl match."""
    inst = _pick_latest_conf(ccfddl_entry, target_year)
    if not inst:
        return None

    deadline = _extract_deadline(inst)
    result: dict[str, Any] = {
        "found": True,
        "deadline": deadline,
        "cycle": str(inst.get("year", "")),
        "location": inst.get("place"),
        "conf_date": inst.get("date"),
        "homepage": inst.get("link"),
        "confidence": 0.95,
        "source_url": "https://ccfddl.com/",
        "note": None,
        "submissions": None,
        "accepted": None,
        "acceptance_rate": None,
    }

    # Abstract deadline note
    timelines = inst.get("timeline") or []
    comments = [tl.get("comment", "") for tl in timelines if tl.get("comment")]
    abs_dls = [tl.get("abstract_deadline", "")[:10] for tl in timelines if tl.get("abstract_deadline")]
    notes = []
    if abs_dls:
        notes.append(f"摘要截止 {abs_dls[0]}")
    notes.extend(comments)
    if notes:
        result["note"] = " · ".join(notes)

    # Acceptance rate from allacc
    if acc_entry:
        rates = acc_entry.get("accept_rates") or []
        if rates:
            latest = max(rates, key=lambda r: r.get("year", 0))
            result["submissions"] = latest.get("submitted")
            result["accepted"] = latest.get("accepted")
            rate_val = latest.get("rate")
            if rate_val is not None:
                result["acceptance_rate"] = round(rate_val * 100, 1)
            result["stats_year"] = latest.get("year")

    return result


# ── DDG + DeepSeek fallback ──────────────────────────────────────────────

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


def _search_and_fetch(abbr: str, name_full: str, target_year: int) -> str | None:
    try:
        from ddgs import DDGS
        query = f'{abbr} {target_year} "{name_full}" call for papers deadline'
        hits = DDGS().text(query, max_results=3)
        if not hits:
            return None
    except Exception as e:
        _log.debug("DDG search failed for %s: %s", abbr, e)
        return None
    parts: list[str] = []
    for hit in hits:
        parts.append(f"[{hit.get('title', '')}] {hit.get('body', '')}")
        url = hit.get("href")
        if url:
            page = _fetch_page(url)
            if page:
                parts.append(page)
    combined = "\n---\n".join(parts)
    return combined[:PAGE_MAX_CHARS] if combined else None


SYSTEM_PROMPT = (
    "You extract conference Call-for-Papers information from web search results. "
    "Return ONLY a valid JSON object, nothing else."
)

USER_PROMPT = """\
Conference: {abbr} ({name_full})
Target edition: {target_year}

Web content:
---
{page_text}
---

Extract JSON: {{"found":bool,"deadline":"YYYY-MM-DD"|null,"cycle":str|null,\
"location":str|null,"conf_date":str|null,"homepage":str|null,\
"confidence":float,"note":str|null,"submissions":int|null,\
"accepted":int|null,"acceptance_rate":float|null}}

IMPORTANT: Only {target_year} edition info. Do not return older dates."""


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


# ── State machine ────────────────────────────────────────────────────────

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


# ── Main crawl ───────────────────────────────────────────────────────────

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
    """One crawl cycle. Primary: ccfddl YAML; fallback: DDG+DeepSeek."""
    sqlite_path = data_dir / "conferences.sqlite"
    manifest_path = data_dir / "manifest.json"

    if not sqlite_path.exists():
        return {"error": "conferences.sqlite not found", "updated": 0}

    today = date.today()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ── 1. Fetch ccfddl YAML (2 requests for all data) ──
    _log.info("conf_crawler: fetching ccfddl.com YAML...")
    allconf = _fetch_yaml(CCFDDL_ALLCONF) or []
    allacc = _fetch_yaml(CCFDDL_ALLACC) or []
    ccfddl_idx = _build_ccfddl_index(allconf)
    acc_idx = _build_acc_index(allacc)
    _log.info("conf_crawler: ccfddl %d confs, %d acc rates", len(ccfddl_idx), len(acc_idx))

    # ── 2. Select rows to process ──
    fd, tmp_path = tempfile.mkstemp(suffix=".sqlite", dir=data_dir)
    os.close(fd)
    shutil.copy2(sqlite_path, tmp_path)
    conn = sqlite3.connect(tmp_path)

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
        os.unlink(tmp_path)
        return {"due": 0, "updated": 0, "found": 0}

    if dry_run:
        conn.close()
        os.unlink(tmp_path)
        return {"due": len(due), "dry_run": True}

    # ── 3. Process each conference ──
    ds_client = OpenAI(base_url=base_url, api_key=api_key) if api_key else None
    updated = 0
    found_count = 0
    ccfddl_matched = 0
    ds_used = 0
    results: list[dict] = []

    for c in due:
        abbr = c["abbr"]
        target = c.get("target_year") or today.year

        # Try ccfddl first (instant, no API call)
        ccfddl_match = _find_ccfddl_match(abbr, ccfddl_idx)
        acc_match = _find_ccfddl_match(abbr, acc_idx)

        extracted: dict[str, Any] | None = None
        source = "none"

        if ccfddl_match:
            extracted = _extract_from_ccfddl(ccfddl_match, acc_match, target)
            source = "ccfddl"
            ccfddl_matched += 1
        elif ds_client:
            # Fallback: DDG search + DeepSeek
            page_text = None
            homepage = c.get("homepage")
            if homepage:
                page_text = _fetch_page(homepage)
                source = "homepage"
            if not page_text:
                page_text = _search_and_fetch(abbr, c["name_full"], target)
                source = "ddg+ds" if page_text else "ds-knowledge"
            if not page_text:
                page_text = f"(No info found for {abbr}. Set found=false.)"
            extracted = _ask_deepseek(ds_client, model, c, page_text)
            ds_used += 1
            time.sleep(INTER_CALL_SLEEP)

        if not extracted or not extracted.get("found"):
            conn.execute(
                "UPDATE conferences SET last_checked_at=?, next_check_at=? WHERE id=?",
                (now_iso, _next_check(c["crawl_state"], now_iso), c["id"]),
            )
            updated += 1
            continue

        # Apply update
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
                stats_year = COALESCE(?, stats_year),
                confidence = ?, source_url = ?,
                crawl_state = ?, last_checked_at = ?, next_check_at = ?
            WHERE id = ?""",
            (
                extracted.get("homepage"), extracted.get("cycle"),
                extracted.get("location"), extracted.get("conf_date"),
                extracted.get("deadline"), extracted.get("note"),
                extracted.get("submissions"), extracted.get("accepted"),
                extracted.get("acceptance_rate"), extracted.get("stats_year"),
                extracted.get("confidence"), extracted.get("source_url"),
                new_state, now_iso, _next_check(new_state, now_iso), c["id"],
            ),
        )
        found_count += 1
        updated += 1
        results.append({"abbr": abbr, "deadline": deadline, "state": new_state, "source": source})

    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM conferences").fetchone()[0]
    conn.close()

    # Atomic replace
    os.replace(tmp_path, sqlite_path)

    # Manifest
    raw = sqlite_path.read_bytes()
    manifest = {
        "schema_version": 1,
        "exported_at": now_iso,
        "claw_version": "crawler-0.2.0",
        "conferences_sqlite_sha256": hashlib.sha256(raw).hexdigest(),
        "conferences_sqlite_bytes": len(raw),
        "counts": {"conferences": count},
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", "utf-8")

    summary = {
        "due": len(due), "updated": updated, "found": found_count,
        "ccfddl_matched": ccfddl_matched, "deepseek_used": ds_used,
    }
    _log.info("conf_crawler: %s", summary)
    return {**summary, "results": results}
