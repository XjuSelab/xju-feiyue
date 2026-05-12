"""Admin-only routes — single-admin gate via settings.admin_sid.

Returns 404 for anyone else so the route doesn't advertise its existence.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LoginEvent, User
from app.deps import get_current_user, get_db
from app.schemas._base import CamelModel, UtcDateTime
from app.settings import settings

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.sid != settings.admin_sid:
        # Generic 404 — non-admins should not learn that /admin/* exists.
        raise HTTPException(status_code=404, detail="Not Found")
    return user


class LoginEventOut(CamelModel):
    id: int
    sid: str
    nickname: str
    name: str
    ip: str
    user_agent: str | None = None
    at: UtcDateTime


@router.get("/login-events", response_model=list[LoginEventOut])
async def list_login_events(
    limit: int = Query(default=200, ge=1, le=1000),
    sid: str | None = Query(default=None, description="filter by user sid"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[LoginEventOut]:
    stmt = (
        select(
            LoginEvent.id,
            LoginEvent.user_sid,
            LoginEvent.ip,
            LoginEvent.user_agent,
            LoginEvent.created_at,
            User.nickname,
            User.name,
        )
        .join(User, User.sid == LoginEvent.user_sid)
        .order_by(LoginEvent.created_at.desc())
        .limit(limit)
    )
    if sid:
        stmt = stmt.where(LoginEvent.user_sid == sid)
    rows = (await db.execute(stmt)).all()
    return [
        LoginEventOut(
            id=row.id,
            sid=row.user_sid,
            nickname=row.nickname,
            name=row.name,
            ip=row.ip,
            user_agent=row.user_agent,
            at=row.created_at,
        )
        for row in rows
    ]
