"""AI moderation tests — classify degradation/retry + review_report flagging."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Report, User
from app.services.moderation import ModerationResult, classify, review_report
from app.settings import settings


def _make_report(reporter_sid: str, snapshot: str = "买粉丝加微信") -> Report:
    return Report(
        id="mod_r1",
        reporter_sid=reporter_sid,
        target_type="note",
        target_snapshot=snapshot,
        reason="spam",
        status="pending",
    )


async def test_classify_skips_when_disabled() -> None:
    # conftest sets DEEPSEEK_DRY_RUN=1 → no upstream call, degrades to unknown.
    res = await classify("任何内容", "spam")
    assert res.label == "unknown"
    assert res.confidence == 0.0


async def test_review_report_flags_high_confidence(
    demo_user: User, db_session: AsyncSession
) -> None:
    report = _make_report(demo_user.sid)
    db_session.add(report)
    await db_session.commit()

    async def fake(_text: str, _reason: str) -> ModerationResult:
        return ModerationResult("spam", 0.92, "含引流广告")

    await review_report("mod_r1", db=db_session, classifier=fake)
    await db_session.refresh(report)
    assert report.status == "ai_flagged"
    assert report.ai_label == "spam"
    assert report.ai_confidence == 0.92
    assert report.ai_reason == "含引流广告"


async def test_review_report_ok_stays_pending(
    demo_user: User, db_session: AsyncSession
) -> None:
    report = _make_report(demo_user.sid, snapshot="今天读了篇好论文")
    db_session.add(report)
    await db_session.commit()

    async def fake(_t: str, _r: str) -> ModerationResult:
        return ModerationResult("ok", 0.1, "未见违规")

    await review_report("mod_r1", db=db_session, classifier=fake)
    await db_session.refresh(report)
    assert report.status == "pending"
    assert report.ai_label == "ok"


async def test_review_report_below_threshold_records_but_not_flagged(
    demo_user: User, db_session: AsyncSession
) -> None:
    report = _make_report(demo_user.sid)
    db_session.add(report)
    await db_session.commit()

    async def fake(_t: str, _r: str) -> ModerationResult:
        return ModerationResult("spam", 0.5, "疑似广告")  # below 0.75 threshold

    await review_report("mod_r1", db=db_session, classifier=fake)
    await db_session.refresh(report)
    assert report.status == "pending"
    assert report.ai_label == "spam"
    assert report.ai_confidence == 0.5


async def test_classify_retries_then_succeeds(monkeypatch) -> None:
    monkeypatch.setattr(settings, "deepseek_dry_run", False)
    monkeypatch.setattr(settings, "deepseek_api_key", "x")
    monkeypatch.setattr("app.services.moderation._BACKOFF_S", 0.01)

    resp = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"label":"spam","confidence":0.88,"reason":"广告"}'
                )
            )
        ]
    )
    create = AsyncMock(side_effect=[RuntimeError("boom"), RuntimeError("boom"), resp])
    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr("app.services.moderation.get_client", lambda: fake_client)

    res = await classify("买粉丝", "spam")
    assert res.label == "spam"
    assert res.confidence == 0.88
    assert create.await_count == 3


async def test_classify_gives_up_after_max_attempts(monkeypatch) -> None:
    monkeypatch.setattr(settings, "deepseek_dry_run", False)
    monkeypatch.setattr(settings, "deepseek_api_key", "x")
    monkeypatch.setattr("app.services.moderation._BACKOFF_S", 0.01)

    create = AsyncMock(side_effect=RuntimeError("down"))
    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr("app.services.moderation.get_client", lambda: fake_client)

    res = await classify("x", "spam")
    assert res.label == "unknown"
    assert create.await_count == 3
