"""In-memory pinyin index for fuzzy advisor-name search.

The schools.sqlite shipped by supervisor-claw has no pinyin column, and the
engine opens it read-only/immutable, so we can't add one at runtime. Instead
we scan ``advisor(id, name_cn)`` once into a tiny in-memory index (~4k rows,
a few hundred KB) and let the query layer match a latin query against it.

The index is rebuilt only when the sqlite mtime changes (claw re-syncs land
via atomic rename → mtime bumps), so it stays in lock-step with the live
engine's hot-reload without any explicit invalidation call.

Two match modes, both substring (= fuzzy):
* full pinyin  — "yaomingxuan" / "yaoming" matches 姚明轩
* initials     — "ymx" matches 姚明轩

A pure-CJK query returns no pinyin hits (``match`` short-circuits); those go
through FTS5 + LIKE in ``schools_query`` instead.
"""
from __future__ import annotations

import re

from pypinyin import Style, lazy_pinyin
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_HAS_LATIN = re.compile(r"[a-zA-Z]")


class PinyinIndex:
    """(advisor_id, full_pinyin, initials) tuples, all lowercased."""

    __slots__ = ("entries",)

    def __init__(self, entries: list[tuple[int, str, str]] | None = None) -> None:
        self.entries: list[tuple[int, str, str]] = entries or []

    @classmethod
    def build(cls, rows: list[tuple[int, str | None]]) -> "PinyinIndex":
        entries: list[tuple[int, str, str]] = []
        for advisor_id, name in rows:
            if not name:
                continue
            full = "".join(lazy_pinyin(name)).lower()
            initials = "".join(lazy_pinyin(name, style=Style.FIRST_LETTER)).lower()
            entries.append((advisor_id, full, initials))
        return cls(entries)

    def match(self, q: str | None) -> set[int]:
        """Return advisor ids whose full pinyin or initials contain ``q``.

        Empty / non-latin queries return an empty set (handled by FTS/LIKE).
        """
        if not q:
            return set()
        ql = q.lower().replace(" ", "")
        if not ql or not _HAS_LATIN.search(ql):
            return set()
        return {aid for aid, full, init in self.entries if ql in full or ql in init}


# Module-level cache keyed by the engine's sqlite mtime. The query layer hands
# us the current mtime; we rebuild only when it changes.
_cache_mtime: float | None = None
_cache_index: PinyinIndex | None = None


async def get_pinyin_index(session: AsyncSession, mtime: float) -> PinyinIndex:
    global _cache_mtime, _cache_index
    if _cache_index is not None and _cache_mtime == mtime:
        return _cache_index
    rows = (await session.execute(text("SELECT id, name_cn FROM advisor"))).all()
    index = PinyinIndex.build([(r.id, r.name_cn) for r in rows])
    _cache_mtime = mtime
    _cache_index = index
    return index
