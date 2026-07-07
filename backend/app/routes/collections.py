"""Collections routes — user-managed note collections + note-detail sidebar."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Collection, CollectionEntry, Note, User
from app.deps import get_current_user, get_db
from app.schemas.collection import (
    CollectionCreateIn,
    CollectionDetailOut,
    CollectionEntryAddIn,
    CollectionNoteOut,
    CollectionOut,
    CollectionReorderIn,
    CollectionUpdateIn,
    NoteCollectionContextOut,
)
from app.schemas.note import NoteAuthorOut

router = APIRouter(tags=["collections"])


def _note_out(note: Note) -> CollectionNoteOut:
    return CollectionNoteOut(
        id=note.id,
        title=note.title,
        summary=note.summary,
        category=note.category,
        created_at=note.created_at,
        read_minutes=note.read_minutes,
        author=NoteAuthorOut(
            sid=note.author.sid,
            nickname=note.author.nickname,
            avatar=note.author.avatar,
            avatar_thumb=note.author.avatar_thumb,
        ),
    )


def _collection_out(collection: Collection, entry_count: int) -> CollectionOut:
    return CollectionOut(
        id=collection.id,
        title=collection.title,
        description=collection.description,
        entry_count=entry_count,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


async def _ensure_owned_collection(
    db: AsyncSession,
    collection_id: str,
    owner_sid: str,
) -> Collection:
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    if collection.owner_sid != owner_sid:
        raise HTTPException(status_code=403, detail="只能管理自己的合集")
    return collection


async def _entry_count_map(
    db: AsyncSession,
    collection_ids: list[str],
) -> dict[str, int]:
    if not collection_ids:
        return {}
    stmt = (
        select(CollectionEntry.collection_id, func.count(CollectionEntry.note_id))
        .where(CollectionEntry.collection_id.in_(collection_ids))
        .group_by(CollectionEntry.collection_id)
    )
    return {row[0]: row[1] for row in (await db.execute(stmt)).all()}


async def _load_entries(db: AsyncSession, collection_id: str) -> list[CollectionEntry]:
    stmt = (
        select(CollectionEntry)
        .join(Note, Note.id == CollectionEntry.note_id)
        .where(
            CollectionEntry.collection_id == collection_id,
            Note.status == "visible",
        )
        .order_by(CollectionEntry.sort_order.asc(), CollectionEntry.created_at.asc())
        .options(selectinload(CollectionEntry.note).selectinload(Note.author))
    )
    return list((await db.execute(stmt)).scalars().all())


async def _load_detail(db: AsyncSession, collection: Collection) -> CollectionDetailOut:
    entries = await _load_entries(db, collection.id)
    return CollectionDetailOut(
        id=collection.id,
        title=collection.title,
        description=collection.description,
        entry_count=len(entries),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        entries=[_note_out(entry.note) for entry in entries],
    )


@router.get("/collections/mine", response_model=list[CollectionOut])
async def list_my_collections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CollectionOut]:
    collections = list(
        (
            await db.execute(
                select(Collection)
                .where(Collection.owner_sid == user.sid)
                .order_by(Collection.updated_at.desc(), Collection.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    counts = await _entry_count_map(db, [c.id for c in collections])
    return [_collection_out(c, counts.get(c.id, 0)) for c in collections]


@router.post("/collections", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionOut:
    collection = Collection(
        id=str(uuid4()),
        owner_sid=user.sid,
        title=body.title.strip(),
        description=body.description.strip(),
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return _collection_out(collection, 0)


@router.patch("/collections/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: str,
    body: CollectionUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionOut:
    collection = await _ensure_owned_collection(db, collection_id, user.sid)
    if body.title is not None:
        collection.title = body.title.strip()
    if body.description is not None:
        collection.description = body.description.strip()
    await db.commit()
    await db.refresh(collection)
    detail = await _load_detail(db, collection)
    return _collection_out(collection, detail.entry_count)


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    collection = await _ensure_owned_collection(db, collection_id, user.sid)
    await db.delete(collection)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/collections/{collection_id}", response_model=CollectionDetailOut)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
) -> CollectionDetailOut:
    collection = await db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    return await _load_detail(db, collection)


@router.post("/collections/{collection_id}/entries", response_model=CollectionDetailOut)
async def add_collection_entry(
    collection_id: str,
    body: CollectionEntryAddIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionDetailOut:
    collection = await _ensure_owned_collection(db, collection_id, user.sid)
    note = await db.get(Note, body.note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if note.author_sid != user.sid:
        raise HTTPException(status_code=403, detail="只能将自己的笔记加入合集")
    if note.status != "visible":
        raise HTTPException(status_code=422, detail="只能将已发布笔记加入合集")

    existing = (
        await db.execute(select(CollectionEntry).where(CollectionEntry.note_id == note.id))
    ).scalar_one_or_none()
    if existing is not None and existing.collection_id != collection.id:
        raise HTTPException(status_code=409, detail="该笔记已属于其他合集")

    if existing is None:
        if body.sort_order is None:
            max_sort = (
                await db.execute(
                    select(func.coalesce(func.max(CollectionEntry.sort_order), -1)).where(
                        CollectionEntry.collection_id == collection.id
                    )
                )
            ).scalar_one()
            sort_order = int(max_sort) + 1
        else:
            sort_order = body.sort_order
        db.add(
            CollectionEntry(
                collection_id=collection.id,
                note_id=note.id,
                sort_order=sort_order,
            )
        )
    elif body.sort_order is not None:
        existing.sort_order = body.sort_order

    await db.commit()
    await db.refresh(collection)
    return await _load_detail(db, collection)


@router.patch("/collections/{collection_id}/entries/order", response_model=CollectionDetailOut)
async def reorder_collection_entries(
    collection_id: str,
    body: CollectionReorderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionDetailOut:
    """Persist a drag-sorted order: sort_order = position in `note_ids`."""
    collection = await _ensure_owned_collection(db, collection_id, user.sid)
    by_note = {e.note_id: e for e in await _load_entries(db, collection.id)}
    for idx, note_id in enumerate(body.note_ids):
        entry = by_note.get(note_id)
        if entry is not None:
            entry.sort_order = idx
    await db.commit()
    await db.refresh(collection)
    return await _load_detail(db, collection)


@router.delete(
    "/collections/{collection_id}/entries/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_collection_entry(
    collection_id: str,
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _ensure_owned_collection(db, collection_id, user.sid)
    entry = await db.get(CollectionEntry, (collection_id, note_id))
    if not entry:
        raise HTTPException(status_code=404, detail="合集条目不存在")
    await db.delete(entry)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/notes/{note_id}/collection", response_model=NoteCollectionContextOut | None)
async def get_note_collection_context(
    note_id: str,
    db: AsyncSession = Depends(get_db),
) -> NoteCollectionContextOut | None:
    entry = (
        await db.execute(select(CollectionEntry).where(CollectionEntry.note_id == note_id))
    ).scalar_one_or_none()
    if entry is None:
        return None

    collection = await db.get(Collection, entry.collection_id)
    if collection is None:
        return None

    entries = await _load_entries(db, collection.id)
    items = [_note_out(e.note) for e in entries]
    current_index = next((i for i, item in enumerate(items) if item.id == note_id), -1)
    if current_index < 0:
        return None

    return NoteCollectionContextOut(
        collection=_collection_out(collection, len(items)),
        entries=items,
        current_index=current_index,
    )