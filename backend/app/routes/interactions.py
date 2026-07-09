"""Likes / Comments — see BACKEND_SPEC.md §2 (Interactions)."""
from __future__ import annotations

from collections.abc import Iterable
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Comment,
    CommentReaction,
    Favorite,
    Like,
    Note,
    NoteDislike,
    User,
)
from app.deps import get_current_user, get_db, get_optional_user
from app.ratelimit import rate_limit
from app.schemas.interaction import CommentIn, CommentOut, PaginatedComments
from app.schemas.note import NoteAuthorOut
from app.services.comments import DEFAULT_LIMIT, list_comments

router = APIRouter(tags=["interactions"])


def _author_out(user: User) -> NoteAuthorOut:
    return NoteAuthorOut(
        sid=user.sid,
        nickname=user.nickname,
        avatar=user.avatar,
        avatar_thumb=user.avatar_thumb,
    )


def _to_comment_out(
    c: Comment,
    *,
    likes: int = 0,
    dislikes: int = 0,
    liked_by_me: bool = False,
    disliked_by_me: bool = False,
) -> CommentOut:
    return CommentOut(
        id=c.id,
        note_id=c.note_id,
        author=_author_out(c.author),
        content=c.content,
        created_at=c.created_at,
        parent_id=c.parent_id,
        reply_to_sid=c.reply_to_sid,
        reply_to=_author_out(c.reply_to) if c.reply_to is not None else None,
        images=list(c.images or []),
        status=c.status,
        likes=likes,
        dislikes=dislikes,
        liked_by_me=liked_by_me,
        disliked_by_me=disliked_by_me,
        anchor_text=c.anchor_text,
        anchor_offset_start=c.anchor_offset_start,
        anchor_offset_end=c.anchor_offset_end,
    )


async def _ensure_note(db: AsyncSession, note_id: str) -> Note:
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note


async def _ensure_comment(db: AsyncSession, comment_id: str) -> Comment:
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    return comment


async def _count_comment_reactions(
    db: AsyncSession,
    comment_ids: Iterable[str],
) -> tuple[dict[str, int], dict[str, int]]:
    ids = list(comment_ids)
    if not ids:
        return {}, {}
    stmt = (
        select(
            CommentReaction.comment_id,
            CommentReaction.kind,
            func.count(CommentReaction.user_sid),
        )
        .where(CommentReaction.comment_id.in_(ids))
        .group_by(CommentReaction.comment_id, CommentReaction.kind)
    )
    likes: dict[str, int] = {}
    dislikes: dict[str, int] = {}
    for comment_id, kind, count in (await db.execute(stmt)).all():
        if kind == "like":
            likes[comment_id] = count
        elif kind == "dislike":
            dislikes[comment_id] = count
    return likes, dislikes


async def _comment_reaction_state(
    db: AsyncSession,
    user_sid: str | None,
    comment_ids: Iterable[str],
) -> tuple[set[str], set[str]]:
    ids = list(comment_ids)
    if not ids or not user_sid:
        return set(), set()
    stmt = select(CommentReaction.comment_id, CommentReaction.kind).where(
        CommentReaction.user_sid == user_sid,
        CommentReaction.comment_id.in_(ids),
    )
    liked: set[str] = set()
    disliked: set[str] = set()
    for comment_id, kind in (await db.execute(stmt)).all():
        if kind == "like":
            liked.add(comment_id)
        elif kind == "dislike":
            disliked.add(comment_id)
    return liked, disliked


@router.post("/notes/{note_id}/like", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def like(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _ensure_note(db, note_id)
    existing_dislike = await db.get(NoteDislike, (note_id, user.sid))
    if existing_dislike is not None:
        await db.delete(existing_dislike)
    existing_like = await db.get(Like, (note_id, user.sid))
    if existing_like is None:
        db.add(Like(note_id=note_id, user_sid=user.sid))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/notes/{note_id}/like", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def unlike(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await db.execute(
        delete(Like).where(Like.note_id == note_id, Like.user_sid == user.sid)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notes/{note_id}/dislike", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def dislike(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _ensure_note(db, note_id)
    existing_like = await db.get(Like, (note_id, user.sid))
    if existing_like is not None:
        await db.delete(existing_like)
    existing_dislike = await db.get(NoteDislike, (note_id, user.sid))
    if existing_dislike is None:
        db.add(NoteDislike(note_id=note_id, user_sid=user.sid))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/notes/{note_id}/dislike", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def undislike(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await db.execute(
        delete(NoteDislike).where(
            NoteDislike.note_id == note_id,
            NoteDislike.user_sid == user.sid,
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notes/{note_id}/favorite", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def favorite(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _ensure_note(db, note_id)
    existing = await db.get(Favorite, (note_id, user.sid))
    if existing is None:
        db.add(Favorite(note_id=note_id, user_sid=user.sid))
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/notes/{note_id}/favorite", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def unfavorite(
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await db.execute(
        delete(Favorite).where(
            Favorite.note_id == note_id,
            Favorite.user_sid == user.sid,
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/notes/{note_id}/comments", response_model=PaginatedComments)
async def list_comments_route(
    note_id: str,
    cursor: str | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=100),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedComments:
    rows, next_cursor = await list_comments(
        db, note_id, cursor, limit, viewer_sid=user.sid if user else None
    )
    comment_ids = [c.id for c in rows]
    like_counts, dislike_counts = await _count_comment_reactions(db, comment_ids)
    liked_ids, disliked_ids = await _comment_reaction_state(
        db, user.sid if user else None, comment_ids
    )
    return PaginatedComments(
        items=[
            _to_comment_out(
                c,
                likes=like_counts.get(c.id, 0),
                dislikes=dislike_counts.get(c.id, 0),
                liked_by_me=c.id in liked_ids,
                disliked_by_me=c.id in disliked_ids,
            )
            for c in rows
        ],
        next_cursor=next_cursor,
    )


@router.post(
    "/notes/{note_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("comment"))],
)
async def create_comment(
    note_id: str,
    body: CommentIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    await _ensure_note(db, note_id)

    parent: Comment | None = None
    if body.parent_id is not None:
        parent = await db.get(Comment, body.parent_id)
        if parent is None or parent.note_id != note_id:
            raise HTTPException(status_code=404, detail="父评论不存在")
        if parent.parent_id is not None:
            raise HTTPException(status_code=422, detail="仅支持两层评论")

    reply_to_sid = body.reply_to_sid
    if reply_to_sid is not None:
        reply_to = await db.get(User, reply_to_sid)
        if reply_to is None:
            raise HTTPException(status_code=404, detail="被回复用户不存在")
    elif parent is not None:
        reply_to_sid = parent.author_sid

    comment = Comment(
        id=str(uuid4()),
        note_id=note_id,
        author_sid=user.sid,
        parent_id=parent.id if parent is not None else None,
        reply_to_sid=reply_to_sid,
        content=body.content,
        images=list(body.images),
        anchor_text=body.anchor_text,
        anchor_offset_start=body.anchor_offset_start,
        anchor_offset_end=body.anchor_offset_end,
    )
    db.add(comment)
    await db.commit()

    stmt = (
        select(Comment)
        .where(Comment.id == comment.id)
        .options(
            selectinload(Comment.author),
            selectinload(Comment.reply_to),
        )
    )
    fresh = (await db.execute(stmt)).scalar_one()
    return _to_comment_out(fresh)


@router.delete(
    "/notes/{note_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment(
    note_id: str,
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    comment = await db.get(Comment, comment_id)
    if not comment or comment.note_id != note_id:
        raise HTTPException(status_code=404, detail="评论不存在")

    if comment.author_sid != user.sid:
        # Note author may delete any comment on their own note.
        note = await db.get(Note, note_id)
        if not note or note.author_sid != user.sid:
            raise HTTPException(status_code=403, detail="只能删除自己的评论")

    await db.delete(comment)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _set_comment_reaction(
    comment_id: str,
    kind: str,
    user: User,
    db: AsyncSession,
) -> Response:
    await _ensure_comment(db, comment_id)
    existing = await db.get(CommentReaction, (comment_id, user.sid))
    if existing is None:
        db.add(CommentReaction(comment_id=comment_id, user_sid=user.sid, kind=kind))
        await db.commit()
    elif existing.kind != kind:
        existing.kind = kind
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _clear_comment_reaction(
    comment_id: str,
    kind: str,
    user: User,
    db: AsyncSession,
) -> Response:
    await db.execute(
        delete(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_sid == user.sid,
            CommentReaction.kind == kind,
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/comments/{comment_id}/like", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def like_comment(
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _set_comment_reaction(comment_id, "like", user, db)


@router.delete("/comments/{comment_id}/like", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def unlike_comment(
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _clear_comment_reaction(comment_id, "like", user, db)


@router.post("/comments/{comment_id}/dislike", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def dislike_comment(
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _set_comment_reaction(comment_id, "dislike", user, db)


@router.delete("/comments/{comment_id}/dislike", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(rate_limit("interaction"))])
async def undislike_comment(
    comment_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _clear_comment_reaction(comment_id, "dislike", user, db)