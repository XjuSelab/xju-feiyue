"""In-process sliding-window rate limiting for high-frequency write endpoints.

The platform runs as a single systemd uvicorn behind nginx, so an in-memory
per-``(user, bucket)`` sliding-window log is exact, O(1) amortised and needs no
extra dependency. If the app is ever scaled to multiple workers/hosts, swap the
store for Redis — the ``rate_limit`` dependency signature stays the same.
"""
from __future__ import annotations

import math
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, status

from app.db.models import User
from app.deps import get_current_user
from app.settings import settings

# bucket -> (max_requests, window_seconds). Kept as a module-level dict (read at
# request time) so tests can tighten a bucket without re-importing routes.
LIMITS: dict[str, tuple[int, float]] = {
    # 点赞 / 点踩 / 收藏 / 评论表态 合计（允许正常连点，挡脚本狂刷）
    "interaction": (30, 10.0),
    # 发评论
    "comment": (10, 60.0),
    # 提交举报（每单还会触发一次后台 AI 预审调用，必须挡刷单）
    "report": (5, 60.0),
}


class SlidingWindowLimiter:
    """Sliding-window *log*: keep the timestamps of accepted hits per key."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(
        self, key: str, limit: int, window: float, now: float | None = None
    ) -> tuple[bool, float]:
        """Return ``(allowed, retry_after_seconds)``.

        Only accepted hits are recorded, so a rejected request does not extend
        the window; ``retry_after`` is when the oldest in-window hit expires.
        """
        now = time.monotonic() if now is None else now
        q = self._hits[key]
        cutoff = now - window
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= limit:
            return False, max(q[0] + window - now, 0.0)
        q.append(now)
        return True, 0.0

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()


def rate_limit(bucket: str):
    """FastAPI dependency factory: throttle ``bucket`` per authenticated user.

    Depends on ``get_current_user`` (FastAPI caches it within the request, so
    auth runs once and unauthenticated callers are rejected with 401 first).
    """

    async def _dep(user: User = Depends(get_current_user)) -> None:
        if not settings.rate_limit_enabled:
            return
        limit, window = LIMITS[bucket]
        allowed, retry_after = limiter.check(f"{bucket}:{user.sid}", limit, window)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="操作太频繁，请稍后再试",
                headers={"Retry-After": str(math.ceil(retry_after))},
            )

    return _dep
