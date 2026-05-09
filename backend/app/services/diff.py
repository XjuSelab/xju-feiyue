"""diff_match_patch wrapper that mirrors frontend src/features/editor/ai/diffEngine.ts.

Output is a list of { type: equal|add|del, text } segments — same shape as the
frontend's `DiffSegment` zod schema.
"""
from __future__ import annotations

from diff_match_patch import diff_match_patch

from app.schemas.ai import DiffSegment

_DMP_OP = {-1: "del", 0: "equal", 1: "add"}


def compute_diff_segments(before: str, after: str) -> list[DiffSegment]:
    dmp = diff_match_patch()
    diffs = dmp.diff_main(before, after)
    dmp.diff_cleanupSemantic(diffs)
    return [DiffSegment(type=_DMP_OP[op], text=text) for op, text in diffs if text]
