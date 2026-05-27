"""HTTP routes for /conferences and /admin/conferences/reload."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.conferences_engine import (
    ConferencesDataMissing,
    ConferencesEngineHolder,
    get_holder,
)
from app.db.models import User
from app.routes.admin import require_admin
from app.schemas.conference import (
    ConferenceRow,
    ConferencesOut,
    ManifestOut,
    ReloadResult,
)
from app.services.conferences_query import list_conferences

router = APIRouter(tags=["conferences"])


def _get_holder() -> ConferencesEngineHolder:
    return get_holder()


def _manifest_or_none(holder: ConferencesEngineHolder) -> ManifestOut | None:
    m = holder.manifest
    return ManifestOut.model_validate(m) if m else None


async def _session_for(holder: ConferencesEngineHolder) -> AsyncSession:
    try:
        engine = await holder.get_engine()
    except ConferencesDataMissing as exc:
        raise HTTPException(status_code=503, detail="conferences data not ready") from exc
    return AsyncSession(engine, expire_on_commit=False)


@router.get("/conferences", response_model=ConferencesOut)
async def conferences_list(
    holder: ConferencesEngineHolder = Depends(_get_holder),
) -> ConferencesOut:
    session = await _session_for(holder)
    try:
        rows = await list_conferences(session)
    finally:
        await session.close()
    return ConferencesOut(
        conferences=[ConferenceRow.model_validate(r) for r in rows],
        count=len(rows),
        manifest=_manifest_or_none(holder),
    )


@router.post("/admin/conferences/reload", response_model=ReloadResult)
async def conferences_reload(
    _admin: User = Depends(require_admin),
    holder: ConferencesEngineHolder = Depends(_get_holder),
) -> ReloadResult:
    ok = await holder.force_reload()
    return ReloadResult(ok=ok, manifest=_manifest_or_none(holder))
