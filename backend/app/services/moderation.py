"""AI pre-screening of reports (improvement item 53).

`classify()` asks DeepSeek to label a snapshot of reported content; it is
best-effort — dry-run / missing key / repeated upstream failure all degrade to
an `unknown` result rather than raising. `review_report()` is the fire-and-forget
entrypoint scheduled from POST /reports: it loads the report in its own session,
records the AI verdict, and auto-flags high-confidence violations for the admin
queue. A human still makes the final ruling via POST /reports/{id}/resolve.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from app.db.models import Report
from app.db.session import AsyncSessionLocal
from app.services.ai_compose import get_client
from app.settings import settings

_MAX_ATTEMPTS = 3
_BACKOFF_S = 0.5
_LABELS = {"ok", "spam", "harassment", "sexual", "illegal", "misinfo", "infringement", "other"}

_SYSTEM_PROMPT = (
    "你是社区内容安全审核助手。判断被举报的内容是否违规，只输出 JSON："
    '{"label": <类别>, "confidence": <0~1 小数>, "reason": <一句话中文理由>}。'
    "label 取值：ok（未见违规）、spam（垃圾广告）、harassment（辱骂骚扰）、"
    "sexual（色情低俗）、illegal（违法有害）、misinfo（不实信息）、"
    "infringement（侵权）、other（其他违规）。"
)


@dataclass
class ModerationResult:
    label: str
    confidence: float
    reason: str


def _parse(content: str) -> ModerationResult:
    text = content.strip()
    if text.startswith("```"):
        # strip ```json ... ``` fences some models add
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return ModerationResult("unknown", 0.0, "AI 返回无法解析")
    label = str(data.get("label", "unknown"))
    if label not in _LABELS:
        label = "other" if label != "unknown" else "unknown"
    try:
        confidence = float(data.get("confidence", 0.0))
    except (ValueError, TypeError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    reason = str(data.get("reason", ""))[:500]
    return ModerationResult(label, confidence, reason)


async def classify(text: str, reason: str) -> ModerationResult:
    """Best-effort AI label for reported content. Never raises."""
    if settings.deepseek_dry_run or not settings.deepseek_api_key:
        return ModerationResult("unknown", 0.0, "AI 审查未启用")

    user_prompt = f"举报理由：{reason}\n\n被举报内容：\n{text}"
    for attempt in range(_MAX_ATTEMPTS):
        try:
            client = get_client()
            resp = await client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,
                max_tokens=200,
            )
            content = resp.choices[0].message.content if resp.choices else ""
            return _parse(content or "")
        except Exception:  # noqa: BLE001 — best-effort; retry then degrade
            if attempt + 1 >= _MAX_ATTEMPTS:
                return ModerationResult("unknown", 0.0, "AI 审查暂时不可用")
            await asyncio.sleep(_BACKOFF_S * (attempt + 1))
    return ModerationResult("unknown", 0.0, "AI 审查暂时不可用")


async def review_report(report_id: str, *, db=None, classifier=None) -> None:
    """Record an AI verdict on a pending report; auto-flag strong violations.

    Runs as a background task (own session) in prod; tests pass `db` +
    `classifier` to drive it synchronously. Swallows all errors.
    """
    own_session = db is None
    if own_session:
        db = AsyncSessionLocal()
    try:
        report = await db.get(Report, report_id)
        if report is None or report.status != "pending":
            return
        result = await (classifier or classify)(report.target_snapshot, report.reason)
        report.ai_label = result.label
        report.ai_confidence = result.confidence
        report.ai_reason = result.reason
        if (
            result.label not in ("ok", "unknown")
            and result.confidence >= settings.moderation_flag_threshold
            and report.status == "pending"
        ):
            report.status = "ai_flagged"
        await db.commit()
    except Exception:  # noqa: BLE001 — never crash the background worker
        await db.rollback()
    finally:
        if own_session:
            await db.close()
