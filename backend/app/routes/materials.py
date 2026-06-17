"""HTTP routes for /materials/* — shared course-material knowledge base.

Wire format is camelCase (app/schemas/material.py). The materials page is a
**shared knowledge base** (plan decision §1): list/detail endpoints return
*every* non-deleted resource regardless of owner, so any logged-in user can
browse them. Write operations (create resource / upload / make folder /
rename / reorder / delete) require auth, and modifying or deleting a resource
or its files additionally requires ``owner_sid == user.sid`` (403 otherwise).
Any logged-in user may create their own resources.

The top-level prefix `/materials` matches `/schools` / `/conferences`; each
path carries its own `/materials` segment (no router `prefix=`) and
`main.py` wires the router (done in the integration step, not here).
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MaterialFile, MaterialNotice, MaterialResource, User
from app.deps import get_current_user, get_db, get_optional_user
from app.schemas.material import (
    FileOut,
    FolderCreateIn,
    NoticeOut,
    NoticeUpdateIn,
    RenameIn,
    ReorderIn,
    ResourceCreateIn,
    ResourceOut,
    ResourceUpdateIn,
)
from app.services import materials as svc
from app.services.auth import is_admin
from app.services.uploads_common import normalize_ext, save_upload

router = APIRouter(tags=["materials"])


# ---------------------------------------------------------------------------
# Resource CRUD
# ---------------------------------------------------------------------------

@router.get("/materials/resources", response_model=list[ResourceOut])
async def list_resources(
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
) -> list[ResourceOut]:
    """List every non-deleted resource (shared knowledge base, no owner filter).

    Optional case-insensitive `q` matches title/description. Each resource is
    returned with its file tree (batched: 2 queries total) so list cards can
    show file count / directory preview / recent uploads.
    """
    stmt = select(MaterialResource).where(
        MaterialResource.deleted == False  # noqa: E712
    )
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            MaterialResource.title.ilike(like)
            | MaterialResource.description.ilike(like)
        )
    stmt = stmt.order_by(
        MaterialResource.sort_order, MaterialResource.created_at.desc()
    )
    resources = (await db.execute(stmt)).scalars().all()
    return await svc.resources_with_trees(db, list(resources))


@router.get("/materials/resources/{rid}", response_model=ResourceOut)
async def get_resource(
    rid: str,
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
) -> ResourceOut:
    """Resource detail with its assembled file tree (shared read)."""
    resource = await svc.get_resource_or_404(db, rid)
    rows = await svc.list_resource_files(db, rid)
    tree = svc.build_file_tree(rows)
    return svc.resource_to_out(resource, tree)


@router.post("/materials/resources", response_model=ResourceOut, status_code=201)
async def create_resource(
    body: ResourceCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceOut:
    """Create a resource owned by the current user."""
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="标题不能为空")
    resource = MaterialResource(
        id=uuid4().hex,
        title=title,
        description=(body.description or "").strip(),
        tag=body.tag,
        owner_sid=user.sid,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return svc.resource_to_out(resource)


@router.patch("/materials/resources/{rid}", response_model=ResourceOut)
async def update_resource(
    rid: str,
    body: ResourceUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceOut:
    """Update a resource's metadata (owner only)."""
    resource = await svc.get_resource_or_404(db, rid)
    svc.ensure_owner(resource, user)

    if body.title is not None:
        title = body.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="标题不能为空")
        resource.title = title
    if body.description is not None:
        resource.description = body.description.strip()
    # Only touch `tag` when the client actually sent the field: omitting it
    # leaves the badge unchanged, sending `tag=null` explicitly clears it.
    # (Pydantic can't tell "omitted" from "null" by value alone, so we look
    # at the set of fields present in the request body.)
    if "tag" in body.model_fields_set:
        resource.tag = body.tag

    await db.commit()
    await db.refresh(resource)
    rows = await svc.list_resource_files(db, rid)
    return svc.resource_to_out(resource, svc.build_file_tree(rows))


@router.delete("/materials/resources/{rid}", status_code=204)
async def delete_resource(
    rid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a resource + cascade soft-delete its files + unlink blobs."""
    resource = await svc.get_resource_or_404(db, rid)
    svc.ensure_owner(resource, user)
    await svc.soft_delete_resource(db, resource)
    await db.commit()


# ---------------------------------------------------------------------------
# File tree
# ---------------------------------------------------------------------------

@router.get("/materials/resources/{rid}/files", response_model=list[FileOut])
async def list_files(
    rid: str,
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
):
    """The resource's file tree, assembled from a flat SELECT (shared read)."""
    await svc.get_resource_or_404(db, rid)
    rows = await svc.list_resource_files(db, rid)
    return svc.build_file_tree(rows)


@router.post("/materials/resources/{rid}/files", response_model=list[FileOut])
async def upload_files(
    rid: str,
    folder_id: str | None = Query(default=None, alias="folderId"),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload one or more files into a resource (root or a folder).

    Owner-only. Each file is streamed to disk via the shared
    `save_upload` (50 MB cap, magic-byte sniff, deny-list), then a
    `MaterialFile` row is appended at the end of the target scope. Returns the
    freshly built tree so the client can re-render in one round-trip.

    Same-name uploads do **not** 409: a previously stuck-but-successful upload
    may have squatted the name, so we auto-rename the new file to the first free
    ``基名 (n).ext`` variant (`svc.unique_upload_name`). Each row is flushed
    before the next file is processed so the probe sees in-batch siblings too
    (two identical names in one request → ``x.pdf`` + ``x (1).pdf``). Folder
    create/rename keep their 409 — only uploads auto-rename.
    """
    resource = await svc.get_resource_or_404(db, rid)
    svc.ensure_owner(resource, user)

    # Validate the target folder belongs to this resource (or root).
    if folder_id is not None:
        folder = await svc.get_file_or_404(db, folder_id)
        if folder.resource_id != rid or not folder.is_folder:
            raise HTTPException(status_code=400, detail="目标文件夹无效")

    dest_dir = svc.MATERIALS_DIR / user.sid / rid
    order = await svc.next_sort_order(db, rid, folder_id)

    for upload in files:
        display_name = svc.clean_name(upload.filename)
        display_name = await svc.unique_upload_name(
            db, rid, folder_id, display_name
        )
        saved = await save_upload(upload, dest_dir)
        db.add(
            MaterialFile(
                id=uuid4().hex,
                resource_id=rid,
                parent_id=folder_id,
                name=display_name,
                is_folder=False,
                ext=saved.ext.lstrip("."),
                mime=saved.mime,
                size_bytes=saved.size,
                url=svc.public_url(user.sid, rid, saved.fname),
                storage_path=svc.storage_rel_path(user.sid, rid, saved.fname),
                sort_order=order,
            )
        )
        # Flush so the next iteration's `unique_upload_name` probe sees this
        # just-added sibling (same-name files in a single multi-file request).
        await db.flush()
        order += 1

    await db.commit()
    rows = await svc.list_resource_files(db, rid)
    return svc.build_file_tree(rows)


@router.post("/materials/resources/{rid}/folders", response_model=FileOut, status_code=201)
async def create_folder(
    rid: str,
    body: FolderCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an (empty) folder at the resource root or inside another folder."""
    resource = await svc.get_resource_or_404(db, rid)
    svc.ensure_owner(resource, user)

    name = svc.clean_name(body.name)
    if not (body.name or "").strip():
        raise HTTPException(status_code=422, detail="文件夹名不能为空")

    parent_id = body.parent_id
    if parent_id is not None:
        parent = await svc.get_file_or_404(db, parent_id)
        if parent.resource_id != rid or not parent.is_folder:
            raise HTTPException(status_code=400, detail="父文件夹无效")

    await svc.assert_name_free(db, rid, parent_id, name)
    order = await svc.next_sort_order(db, rid, parent_id)
    folder = MaterialFile(
        id=uuid4().hex,
        resource_id=rid,
        parent_id=parent_id,
        name=name,
        is_folder=True,
        sort_order=order,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return svc._file_to_out(folder, [])


@router.patch("/materials/files/{file_id}/rename", response_model=FileOut)
async def rename_file(
    file_id: str,
    body: RenameIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a file/folder (owner only).

    For files the original extension is preserved regardless of what the user
    types (the on-disk uuid name is decoupled — we only touch the DB `name`,
    never mv the physical file; the `.ext` column is the source of truth for
    icon/preview). Folders take the new name verbatim.
    """
    node = await svc.get_file_or_404(db, file_id)
    resource = await svc.get_resource_or_404(db, node.resource_id)
    svc.ensure_owner(resource, user)

    if not (body.name or "").strip():
        raise HTTPException(status_code=422, detail="名称不能为空")
    new_name = svc.clean_name(body.name)

    if not node.is_folder and node.ext:
        # Force the stored extension. Strip any extension the user typed, then
        # re-append the canonical one.
        typed_ext = normalize_ext(new_name)  # ".pdf" or ""
        base = new_name[: -len(typed_ext)] if typed_ext else new_name
        base = base.strip() or "file"
        new_name = f"{base}.{node.ext}"

    await svc.assert_name_free(
        db, node.resource_id, node.parent_id, new_name, exclude_id=node.id
    )
    node.name = new_name
    await db.commit()
    await db.refresh(node)
    return svc._file_to_out(node, [])


@router.post("/materials/files/reorder", status_code=204)
async def reorder(
    body: ReorderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Move/reorder a node (owner only). 400 on an ancestor cycle."""
    drag = await svc.get_file_or_404(db, body.drag_id)
    resource = await svc.get_resource_or_404(db, drag.resource_id)
    svc.ensure_owner(resource, user)
    await svc.reorder_file(db, body.drag_id, body.drop_id, body.position)
    await db.commit()


@router.delete("/materials/files/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a file (owner only) + unlink its disk object."""
    node = await svc.get_file_or_404(db, file_id)
    resource = await svc.get_resource_or_404(db, node.resource_id)
    svc.ensure_owner(resource, user)
    if node.is_folder:
        raise HTTPException(
            status_code=400, detail="请使用删除文件夹接口删除文件夹"
        )
    await svc.soft_delete_subtree(db, node)
    await db.commit()


@router.delete("/materials/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Recursively soft-delete a folder + its subtree (owner only)."""
    node = await svc.get_file_or_404(db, folder_id)
    resource = await svc.get_resource_or_404(db, node.resource_id)
    svc.ensure_owner(resource, user)
    if not node.is_folder:
        raise HTTPException(
            status_code=400, detail="请使用删除文件接口删除文件"
        )
    await svc.soft_delete_subtree(db, node)
    await db.commit()


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@router.get("/materials/files/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
) -> FileResponse:
    """Stream a file with a UTF-8 `Content-Disposition: attachment` (shared read).

    Uses `FileResponse` (sendfile) over the on-disk blob located via
    `storage_path`. The filename is RFC 5987 percent-encoded so non-ASCII
    names survive the header. `X-Content-Type-Options: nosniff` mirrors the
    nginx static-hardening policy for direct `/uploads` links.
    """
    node = await svc.get_file_or_404(db, file_id)
    if node.is_folder or not node.storage_path:
        raise HTTPException(status_code=400, detail="文件夹不能下载")
    path = svc.UPLOAD_ROOT / node.storage_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="文件已不存在")

    ascii_fallback = node.name.encode("ascii", "ignore").decode("ascii") or "file"
    disposition = (
        f"attachment; filename=\"{ascii_fallback}\"; "
        f"filename*=UTF-8''{quote(node.name)}"
    )
    return FileResponse(
        path,
        media_type=node.mime or "application/octet-stream",
        headers={
            "Content-Disposition": disposition,
            "X-Content-Type-Options": "nosniff",
        },
    )


# ---------------------------------------------------------------------------
# Acknowledgment notice (the credits bar on the materials list page)
# ---------------------------------------------------------------------------

def _notice_out(row: MaterialNotice | None) -> NoticeOut:
    """Map the singleton notice row → wire shape (defensive when missing)."""
    if row is None:
        return NoticeOut(content="", visible=False, update_date=datetime.now(timezone.utc))
    return NoticeOut(content=row.content, visible=row.visible, update_date=row.updated_at)


@router.get("/materials/notice", response_model=NoticeOut)
async def get_notice(
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
) -> NoticeOut:
    """The acknowledgment bar (shared read; ``visible=False`` = admin-hidden)."""
    row = await db.get(MaterialNotice, MaterialNotice.SINGLETON_ID)
    return _notice_out(row)


@router.put("/materials/notice", response_model=NoticeOut)
async def put_notice(
    body: NoticeUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoticeOut:
    """Set the acknowledgment content and show the bar (admin only).

    Doubles as create (first write), edit (later writes), and restore (after a
    hide) — every successful PUT sets ``visible=True``.
    """
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="只有管理员可以编辑致谢信息")
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="致谢内容不能为空")

    row = await db.get(MaterialNotice, MaterialNotice.SINGLETON_ID)
    if row is None:
        row = MaterialNotice(id=MaterialNotice.SINGLETON_ID)
        db.add(row)
    row.content = content
    row.visible = True
    row.updated_by_sid = user.sid
    await db.commit()
    await db.refresh(row)
    return _notice_out(row)


@router.delete("/materials/notice", status_code=204)
async def delete_notice(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Hide the acknowledgment bar (admin only).

    A soft hide (``visible=False``) — the text is kept so a later PUT restores
    it without re-typing.
    """
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="只有管理员可以删除致谢信息")
    row = await db.get(MaterialNotice, MaterialNotice.SINGLETON_ID)
    if row is not None:
        row.visible = False
        row.updated_by_sid = user.sid
        await db.commit()
