"""FastAPI dependencies — DB session + current user."""
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.services.auth import decode_token


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def client_ip(request: Request) -> str:
    """Best-effort client IP from reverse-proxy headers.

    Our nginx sets `X-Forwarded-For` (`$proxy_add_x_forwarded_for`, with
    the originating client at the leftmost position) and `X-Real-IP`
    (first hop). Trust the leftmost XFF entry because the only writer in
    front of us is our own proxy.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else ""


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    sid = decode_token(auth[7:])
    if not sid:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user = await db.get(User, sid)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


async def get_optional_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User | None:
    """Like get_current_user but silently returns None when unauthenticated.

    Used by read endpoints that want to surface per-user state (e.g.
    `likedByMe`) without forcing login.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    sid = decode_token(auth[7:])
    if not sid:
        return None
    return await db.get(User, sid)
