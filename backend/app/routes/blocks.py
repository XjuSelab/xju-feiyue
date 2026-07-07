"""Block routes — one-directional, silent user blocks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Block, User
from app.deps import get_current_user, get_db
from app.schemas.note import NoteAuthorOut
from app.schemas.report import BlockOut

router = APIRouter(tags=["governance"])


@router.post("/blocks/{blocked_sid}", status_code=status.HTTP_204_NO_CONTENT)
async def block_user(
    blocked_sid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if blocked_sid == user.sid:
        raise HTTPException(status_code=422, detail="不能拉黑自己")
    target = await db.get(User, blocked_sid)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if await db.get(Block, (user.sid, blocked_sid)) is None:
        db.add(Block(blocker_sid=user.sid, blocked_sid=blocked_sid))
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/blocks/{blocked_sid}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    blocked_sid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    existing = await db.get(Block, (user.sid, blocked_sid))
    if existing is not None:
        await db.delete(existing)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/blocks", response_model=list[BlockOut])
async def list_blocks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BlockOut]:
    rows = list(
        (
            await db.execute(
                select(Block)
                .where(Block.blocker_sid == user.sid)
                .order_by(Block.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    sids = [b.blocked_sid for b in rows]
    users: dict[str, User] = {}
    if sids:
        urows = (await db.execute(select(User).where(User.sid.in_(sids)))).scalars().all()
        users = {u.sid: u for u in urows}
    out: list[BlockOut] = []
    for b in rows:
        u = users.get(b.blocked_sid)
        if u is None:
            continue
        out.append(
            BlockOut(
                user=NoteAuthorOut(
                    sid=u.sid,
                    nickname=u.nickname,
                    avatar=u.avatar,
                    avatar_thumb=u.avatar_thumb,
                ),
                created_at=b.created_at,
            )
        )
    return out
