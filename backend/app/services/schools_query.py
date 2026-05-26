"""SQL query layer for the schools data domain.

All filter/sort/pagination/FTS is pushed into SQLite — Python only does
shape massage (JSON parsing, type coercion, aggregating one-to-many
joins). See ``docs/plan-schools-integration.md`` §3.4 for the contract.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.schools_engine import get_holder
from app.services.schools_pinyin import get_pinyin_index

# Frontend's filter.ts uses this exact list — must stay in sync.
KNOWN_TITLES: tuple[str, ...] = ("教授", "副教授", "助理教授", "研究员")
TITLE_OTHER_SENTINEL = "其他"


@dataclass
class AdvisorFilters:
    schools: list[str] = field(default_factory=list)
    depts: list[str] = field(default_factory=list)
    titles: list[str] = field(default_factory=list)  # may contain '其他'
    recruit: list[str] = field(default_factory=list)  # subset of {'yes','no','unk'}
    reps: list[str] = field(default_factory=list)  # may contain 'unknown'
    q: str | None = None
    has_email: bool = False
    has_summary: bool = False


@dataclass
class SortSpec:
    key: str = "default"  # default | name | recruit | rep | updated
    dir: str = "desc"


# ----------------------------------------------------------------------
# SQL building blocks
# ----------------------------------------------------------------------

_REP_SCORE_CASE = (
    "CASE a.reputation_tag "
    "WHEN 'positive' THEN 3 "
    "WHEN 'neutral' THEN 2 "
    "WHEN 'unknown' THEN 1 "
    "WHEN 'negative' THEN 0 "
    "END"
)


def _build_where(
    filters: AdvisorFilters,
    params: dict[str, Any],
    pinyin_ids: set[int] | None = None,
) -> str:
    """Append filter clauses to ``params`` and return the WHERE SQL fragment.

    Empty lists / blank q simply skip their clause — no `IN ()` errors.
    """
    clauses: list[str] = ["1=1"]

    if filters.schools:
        names = _bind_list("school", filters.schools, params)
        clauses.append(f"a.school_code IN ({names})")

    if filters.depts:
        names = _bind_list("dept", filters.depts, params)
        # Subquery so we can keep advisor row unique without GROUP BY.
        clauses.append(
            "EXISTS (SELECT 1 FROM appointment ap WHERE ap.advisor_id = a.id "
            f"AND ap.dept_code IN ({names}))"
        )

    if filters.titles:
        known = [t for t in filters.titles if t in KNOWN_TITLES]
        has_other = TITLE_OTHER_SENTINEL in filters.titles
        pieces: list[str] = []
        if known:
            names = _bind_list("title", known, params)
            pieces.append(f"a.title IN ({names})")
        if has_other:
            other_names = _bind_list("title_known", list(KNOWN_TITLES), params)
            pieces.append(f"(a.title IS NULL OR a.title NOT IN ({other_names}))")
        if pieces:
            clauses.append("(" + " OR ".join(pieces) + ")")

    if filters.recruit:
        pieces = []
        if "yes" in filters.recruit:
            pieces.append("a.is_recruiting = 1")
        if "no" in filters.recruit:
            pieces.append("a.is_recruiting = 0")
        if "unk" in filters.recruit:
            pieces.append("a.is_recruiting IS NULL")
        if pieces:
            clauses.append("(" + " OR ".join(pieces) + ")")

    if filters.reps:
        non_unk = [r for r in filters.reps if r != "unknown"]
        # Frontend's filter.ts maps NULL reputation_tag to 'unknown', so we
        # match both the literal 'unknown' tag and NULL when 'unknown' is
        # selected.
        pieces = []
        if non_unk:
            names = _bind_list("rep", non_unk, params)
            pieces.append(f"a.reputation_tag IN ({names})")
        if "unknown" in filters.reps:
            pieces.append("(a.reputation_tag IS NULL OR a.reputation_tag = 'unknown')")
        if pieces:
            clauses.append("(" + " OR ".join(pieces) + ")")

    if filters.has_email:
        clauses.append("a.email IS NOT NULL AND a.email != ''")

    if filters.has_summary:
        clauses.append("a.enriched_summary IS NOT NULL AND a.enriched_summary != ''")

    # Search block — q matches via ANY of:
    #   * FTS5 MATCH      — CJK token / phrase search over name+bio+interests
    #   * substring LIKE  — partial CJK ("学习"→"机器学习") and latin fragments
    #   * pinyin id-set   — full pinyin / initials, computed in Python upstream
    # OR'd together so "yao" / "ymx" / "姚" / "学习" all hit. q absent → skip.
    if filters.q and filters.q.strip():
        search_pieces: list[str] = []
        fts_query = _escape_fts(filters.q)
        if fts_query:
            params["q_text"] = fts_query
            search_pieces.append(
                "a.id IN (SELECT rowid FROM advisor_fts WHERE advisor_fts MATCH :q_text)"
            )
        # Substring LIKE across name + content so partial CJK matches even
        # inside a token unicode61 keeps whole ("学习" → "机器学习" interests).
        # 4k rows → full scan is sub-millisecond; no index needed.
        params["q_like"] = f"%{_escape_like(filters.q.strip())}%"
        for col in ("a.name_cn", "a.name_en", "a.research_interests", "a.enriched_summary"):
            search_pieces.append(f"{col} LIKE :q_like ESCAPE '\\'")
        if pinyin_ids:
            ids = list(pinyin_ids)
            names = ", ".join(f":pyid_{i}" for i in range(len(ids)))
            params.update({f"pyid_{i}": v for i, v in enumerate(ids)})
            search_pieces.append(f"a.id IN ({names})")
        clauses.append("(" + " OR ".join(search_pieces) + ")")

    return " AND ".join(clauses)


def _bind_list(prefix: str, values: list[str], params: dict[str, Any]) -> str:
    """Allocate :{prefix}_0, :{prefix}_1 … binds and return comma-joined names."""
    names: list[str] = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        names.append(f":{key}")
    return ", ".join(names)


# FTS5 has a small DSL: bare words become tokens, double-quotes phrase, `*`
# prefix, AND/OR/NOT/NEAR operators, `:` column filters. Anything from the
# user that contains these can either crash the parser or do something
# surprising. We strip the operators and wrap each whitespace-separated
# token in double-quotes (which neutralises remaining metachars).
_FTS_STRIP = re.compile(r'["*:(){}\[\]]')


def _escape_fts(q: str | None) -> str | None:
    if not q:
        return None
    q = _FTS_STRIP.sub(" ", q).strip()
    if not q:
        return None
    tokens = [tok for tok in q.split() if tok.upper() not in {"AND", "OR", "NOT", "NEAR"}]
    if not tokens:
        return None
    return " ".join(f'"{tok}"' for tok in tokens)


def _escape_like(s: str) -> str:
    """Neutralise LIKE wildcards so user input is matched literally.

    Pairs with ``ESCAPE '\\'`` in the SQL. Backslash must be escaped first.
    """
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _order_by(sort: SortSpec) -> str:
    direction = "DESC" if (sort.dir or "desc").lower() == "desc" else "ASC"
    inv = "ASC" if direction == "DESC" else "DESC"
    if sort.key == "name":
        return f"a.name_cn COLLATE NOCASE {direction}"
    if sort.key == "recruit":
        return (
            "(a.is_recruiting IS NULL), "
            f"a.is_recruiting {direction}, "
            "a.name_cn COLLATE NOCASE ASC"
        )
    if sort.key == "rep":
        return (
            "(a.reputation_tag IS NULL), "
            f"{_REP_SCORE_CASE} {direction}, "
            "a.name_cn COLLATE NOCASE ASC"
        )
    if sort.key == "updated":
        return (
            "(a.last_enriched_at IS NULL), "
            f"a.last_enriched_at {direction}, "
            "a.name_cn COLLATE NOCASE ASC"
        )
    # default — mirrors frontend/src/features/schools/sort.ts
    return (
        "(a.is_recruiting IS NULL), "
        "a.is_recruiting DESC, "
        f"{_REP_SCORE_CASE} DESC, "
        "a.recruiting_confidence DESC, "
        "a.name_cn COLLATE NOCASE ASC"
    )


# ----------------------------------------------------------------------
# Row marshalling
# ----------------------------------------------------------------------


def _parse_research_interests(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(x) for x in parsed if x is not None]


def _row_to_advisor_base(r: Any, school_name_cn: str) -> dict[str, Any]:
    return {
        "id": r.id,
        "school": {"code": r.school_code, "name_cn": school_name_cn},
        "departments": [],  # filled by caller after batch query
        "name_cn": r.name_cn,
        "name_en": r.name_en,
        "title": r.title,
        "homepage": r.homepage or "",
        "source_url": r.source_url or "",
        "email": r.email,
        "email_obfuscated": bool(r.email_obfuscated),
        "research_interests": _parse_research_interests(r.research_interests),
        "is_recruiting": None if r.is_recruiting is None else bool(r.is_recruiting),
        "recruiting_confidence": r.recruiting_confidence,
        "reputation_tag": r.reputation_tag,
        "enriched_summary": r.enriched_summary,
        "last_enriched_at": r.last_enriched_at,
    }


# ----------------------------------------------------------------------
# Public queries
# ----------------------------------------------------------------------


async def query_advisor_rows(
    session: AsyncSession,
    *,
    filters: AdvisorFilters,
    sort: SortSpec,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int]:
    """Return (rows, total) for the table view."""
    page = max(1, page)
    page_size = max(1, min(200, page_size))
    offset = (page - 1) * page_size

    params: dict[str, Any] = {}
    # Latin query → also match the in-memory pinyin index (full + initials).
    # Pure-CJK queries skip it entirely (FTS + LIKE cover them).
    pinyin_ids: set[int] | None = None
    if filters.q and re.search(r"[a-zA-Z]", filters.q):
        idx = await get_pinyin_index(session, get_holder().mtime)
        pinyin_ids = idx.match(filters.q)
    where = _build_where(filters, params, pinyin_ids)

    # Total count first (cheaper without ORDER BY / LIMIT).
    total_sql = text(f"SELECT COUNT(*) AS n FROM advisor a WHERE {where}")
    total = (await session.execute(total_sql, params)).scalar_one()

    list_params = dict(params, limit=page_size, offset=offset)
    list_sql = text(
        f"""
        SELECT a.id, a.school_code, a.name_cn, a.name_en, a.title,
               a.homepage, a.source_url, a.email, a.email_obfuscated,
               a.research_interests, a.is_recruiting, a.recruiting_confidence,
               a.reputation_tag, a.enriched_summary, a.last_enriched_at,
               s.name_cn AS school_name_cn
        FROM advisor a JOIN school s ON s.code = a.school_code
        WHERE {where}
        ORDER BY {_order_by(sort)}
        LIMIT :limit OFFSET :offset
        """
    )
    rows = (await session.execute(list_sql, list_params)).all()
    advisor_ids = [r.id for r in rows]

    out: dict[int, dict[str, Any]] = {}
    for r in rows:
        out[r.id] = _row_to_advisor_base(r, r.school_name_cn)

    if advisor_ids:
        # Batch fetch departments for the page (avoid N+1).
        dept_params: dict[str, Any] = {}
        ids_clause = _bind_list("aid", [str(i) for i in advisor_ids], dept_params)
        # The bound values are ints in practice; rebind cleanly.
        dept_params = {f"aid_{i}": v for i, v in enumerate(advisor_ids)}
        dept_sql = text(
            f"""
            SELECT ap.advisor_id, d.code, d.name_cn
            FROM appointment ap
            JOIN department d
              ON d.school_code = ap.school_code AND d.code = ap.dept_code
            WHERE ap.advisor_id IN ({ids_clause})
            ORDER BY ap.advisor_id, d.code
            """
        )
        for row in (await session.execute(dept_sql, dept_params)).all():
            out[row.advisor_id]["departments"].append(
                {"code": row.code, "name_cn": row.name_cn}
            )

    # Preserve query ORDER BY (rows already sorted by SQL).
    ordered = [out[i] for i in advisor_ids]
    return ordered, int(total)


async def query_advisor_detail(
    session: AsyncSession, advisor_id: int
) -> dict[str, Any] | None:
    row_sql = text(
        """
        SELECT a.id, a.school_code, a.name_cn, a.name_en, a.title,
               a.homepage, a.source_url, a.email, a.email_obfuscated,
               a.phone, a.photo_url, a.bio_text,
               a.research_interests, a.is_recruiting, a.recruiting_confidence,
               a.reputation_tag, a.enriched_summary, a.last_enriched_at,
               s.name_cn AS school_name_cn
        FROM advisor a JOIN school s ON s.code = a.school_code
        WHERE a.id = :aid
        """
    )
    r = (await session.execute(row_sql, {"aid": advisor_id})).first()
    if r is None:
        return None
    detail = _row_to_advisor_base(r, r.school_name_cn)
    detail.update(
        {
            "phone": r.phone,
            "photo_url": r.photo_url,
            "bio_text": r.bio_text,
            "quotas": [],
            "evaluations": [],
            "trace": [],
        }
    )

    # Departments
    dept_sql = text(
        """
        SELECT d.code, d.name_cn
        FROM appointment ap
        JOIN department d ON d.school_code = ap.school_code AND d.code = ap.dept_code
        WHERE ap.advisor_id = :aid
        ORDER BY d.code
        """
    )
    detail["departments"] = [
        {"code": row.code, "name_cn": row.name_cn}
        for row in (await session.execute(dept_sql, {"aid": advisor_id})).all()
    ]

    quota_sql = text(
        """
        SELECT year, degree, count, confidence, raw_text, source_url
        FROM quota WHERE advisor_id = :aid ORDER BY year DESC NULLS LAST, id ASC
        """
    )
    detail["quotas"] = [
        {
            "year": row.year,
            "degree": row.degree,
            "count": row.count,
            "confidence": row.confidence,
            "raw_text": row.raw_text or "",
            "source_url": row.source_url,
        }
        for row in (await session.execute(quota_sql, {"aid": advisor_id})).all()
    ]

    eval_sql = text(
        """
        SELECT source, source_url, content, rating, posted_at
        FROM evaluation WHERE advisor_id = :aid
        ORDER BY posted_at DESC NULLS LAST, id ASC
        """
    )
    detail["evaluations"] = [
        {
            "source": row.source,
            "source_url": row.source_url,
            "content": row.content,
            "rating": row.rating,
            "posted_at": row.posted_at,
        }
        for row in (await session.execute(eval_sql, {"aid": advisor_id})).all()
    ]

    trace_sql = text(
        """
        SELECT kind, label, detail FROM trace
        WHERE advisor_id = :aid ORDER BY step_idx ASC
        """
    )
    detail["trace"] = [
        {"kind": row.kind, "label": row.label, "detail": row.detail}
        for row in (await session.execute(trace_sql, {"aid": advisor_id})).all()
    ]

    return detail


async def query_schools_meta(session: AsyncSession) -> dict[str, Any]:
    schools_sql = text(
        """
        SELECT s.code, s.name_cn, s.name_en,
               (SELECT COUNT(*) FROM advisor a WHERE a.school_code = s.code) AS n
        FROM school s ORDER BY s.code
        """
    )
    dept_sql = text(
        """
        SELECT school_code, code, name_cn FROM department ORDER BY school_code, code
        """
    )
    title_sql = text(
        """
        SELECT title, COUNT(*) AS n FROM advisor
        WHERE title IS NOT NULL AND title != ''
        GROUP BY title ORDER BY n DESC, title ASC
        """
    )

    depts_by_school: dict[str, list[dict[str, str]]] = {}
    for row in (await session.execute(dept_sql)).all():
        depts_by_school.setdefault(row.school_code, []).append(
            {"code": row.code, "name_cn": row.name_cn}
        )

    schools = [
        {
            "code": row.code,
            "name_cn": row.name_cn,
            "name_en": row.name_en,
            "count": int(row.n),
            "departments": depts_by_school.get(row.code, []),
        }
        for row in (await session.execute(schools_sql)).all()
    ]

    titles = [row.title for row in (await session.execute(title_sql)).all()]
    return {"schools": schools, "titles": titles}
