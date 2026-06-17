"""Materials route tests — shared knowledge base CRUD + file tree + reorder.

Covers: resource CRUD, folder same-name 409, upload (disk + url + camelCase),
rename (extension preserved), reorder before/after/inside (sort_order +
parent_id rewrite), the ancestor cycle guard (400), cascade soft-delete +
physical unlink, root-level dup detection, non-owner 403, unauthenticated 401,
and the shared-read semantics (user B sees user A's resource but cannot modify
it).

Materials is a *shared knowledge base*: GET list/detail return every
non-deleted resource regardless of owner; only the owner may write/modify.
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.main import app
from app.routes import materials as materials_route
from app.services import materials as materials_svc
from app.services.auth import hash_password

# The materials router is wired into `app.main` in the integration step (not
# in this PR's scope). Until then these tests would 404, so we mount it here
# idempotently — if/when main.py already includes it, the duplicate paths are
# harmless (FastAPI matches the first registered route).
if not any(
    getattr(r, "path", "").startswith("/materials")
    for r in app.router.routes
):
    app.include_router(materials_route.router)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _isolate_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect the materials upload roots to a per-test tmp_path.

    `UPLOAD_ROOT` is patched too because `_unlink_storage` / download resolve
    physical paths against it.
    """
    root = tmp_path / "uploads"
    monkeypatch.setattr(materials_svc, "UPLOAD_ROOT", root)
    monkeypatch.setattr(materials_svc, "MATERIALS_DIR", root / "materials")
    return root


@pytest.fixture
async def second_user(db_session: AsyncSession) -> models.User:
    """A second account so we can exercise shared-read + non-owner 403."""
    user = models.User(
        sid="20211010099",
        name="Other User",
        nickname="other",
        password_hash=hash_password("123456"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def second_headers(
    client: AsyncClient, second_user: models.User
) -> dict[str, str]:
    r = await client.post(
        "/auth/login", json={"sid": "20211010099", "password": "123456"}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
async def admin_headers(
    client: AsyncClient, db_session: AsyncSession
) -> dict[str, str]:
    """The configured super-admin (settings.admin_sid) — CRUD-any bypass."""
    from app.settings import settings

    user = models.User(
        sid=settings.admin_sid,
        name="Super Admin",
        nickname="admin",
        password_hash=hash_password("123456"),
    )
    db_session.add(user)
    await db_session.commit()
    r = await client.post(
        "/auth/login", json={"sid": settings.admin_sid, "password": "123456"}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _pdf_bytes() -> bytes:
    """Minimal valid-enough PDF (magic header is all `sniff_magic` checks)."""
    return b"%PDF-1.4\n%%EOF\n"


def _docx_bytes() -> bytes:
    """A real OOXML zip with the wordprocessing manifest + `word/` prefix."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr("word/document.xml", "<document/>")
    return buf.getvalue()


async def _create_resource(
    client: AsyncClient, headers: dict[str, str], title: str = "操作系统课程"
) -> str:
    r = await client.post(
        "/materials/resources",
        json={"title": title, "description": "课件合集", "tag": "专业课"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _upload(
    client: AsyncClient,
    headers: dict[str, str],
    rid: str,
    name: str,
    data: bytes,
    mime: str,
    folder_id: str | None = None,
) -> list[dict]:
    url = f"/materials/resources/{rid}/files"
    if folder_id:
        url += f"?folderId={folder_id}"
    r = await client.post(
        url, files={"files": (name, data, mime)}, headers=headers
    )
    assert r.status_code == 200, r.text
    return r.json()


def _flatten(tree: list[dict]) -> dict[str, dict]:
    """name -> node across the whole tree (names are unique per scope; here
    fixtures keep them globally unique for easy lookup)."""
    out: dict[str, dict] = {}

    def walk(nodes: list[dict]) -> None:
        for n in nodes:
            out[n["name"]] = n
            walk(n.get("children") or [])

    walk(tree)
    return out


# ---------------------------------------------------------------------------
# Resource CRUD
# ---------------------------------------------------------------------------

async def test_create_resource_returns_camelcase(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/materials/resources",
        json={"title": "数据结构", "description": "讲义", "tag": "通识课"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "数据结构"
    assert body["tag"] == "通识课"
    assert body["ownerSid"] == "20211010001"
    assert "createdAt" in body and "created_at" not in body
    assert body["createdAt"].endswith("Z")
    assert "updateDate" in body
    assert body["files"] == []


async def test_create_resource_requires_auth(client: AsyncClient) -> None:
    r = await client.post("/materials/resources", json={"title": "x"})
    assert r.status_code == 401


async def test_create_resource_blank_title_422(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/materials/resources", json={"title": "   "}, headers=auth_headers
    )
    assert r.status_code == 422


async def test_list_resources_shared_read(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
) -> None:
    """B can see A's resource (shared knowledge base, no owner filter)."""
    rid = await _create_resource(client, auth_headers, "A 的资料")
    # B (a different logged-in user) lists and sees it.
    r = await client.get("/materials/resources", headers=second_headers)
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert rid in ids


async def test_list_resources_q_filter(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await _create_resource(client, auth_headers, "操作系统")
    await _create_resource(client, auth_headers, "编译原理")
    r = await client.get("/materials/resources?q=操作", headers=auth_headers)
    titles = [x["title"] for x in r.json()]
    assert titles == ["操作系统"]


async def test_get_resource_detail_with_tree(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    await _upload(client, auth_headers, rid, "讲义.pdf", _pdf_bytes(), "application/pdf")
    r = await client.get(f"/materials/resources/{rid}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["files"]) == 1
    assert body["files"][0]["name"] == "讲义.pdf"
    assert body["files"][0]["isFolder"] is False


async def test_get_resource_missing_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.get("/materials/resources/nope", headers=auth_headers)
    assert r.status_code == 404


async def test_update_resource_owner_only(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
) -> None:
    rid = await _create_resource(client, auth_headers)
    # Owner updates: ok.
    r = await client.patch(
        f"/materials/resources/{rid}",
        json={"title": "新标题"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "新标题"
    # Non-owner: 403.
    r = await client.patch(
        f"/materials/resources/{rid}",
        json={"title": "黑客改的"},
        headers=second_headers,
    )
    assert r.status_code == 403


async def test_super_admin_can_modify_any_resource(
    client: AsyncClient,
    auth_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    """Super-admin (settings.admin_sid) bypasses owner checks: edit / upload /
    delete any user's resource."""
    rid = await _create_resource(client, auth_headers)  # owned by 20211010001
    # Edit someone else's resource -> 200.
    r = await client.patch(
        f"/materials/resources/{rid}",
        json={"title": "管理员改的"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "管理员改的"
    # Upload into it -> 200.
    up = await client.post(
        f"/materials/resources/{rid}/files",
        files={"files": ("admin.pdf", _pdf_bytes(), "application/pdf")},
        headers=admin_headers,
    )
    assert up.status_code == 200, up.text
    # Delete it -> 204.
    d = await client.delete(f"/materials/resources/{rid}", headers=admin_headers)
    assert d.status_code == 204


async def test_user_out_exposes_is_admin(
    client: AsyncClient,
    auth_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    """UserOut.is_admin serializes as camelCase `isAdmin`; True only for the
    configured super-admin."""
    me = await client.get("/auth/me", headers=auth_headers)
    assert me.json()["isAdmin"] is False
    me_admin = await client.get("/auth/me", headers=admin_headers)
    assert me_admin.json()["isAdmin"] is True


# ---------------------------------------------------------------------------
# Folders + dup-name
# ---------------------------------------------------------------------------

async def test_create_folder(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    r = await client.post(
        f"/materials/resources/{rid}/folders",
        json={"name": "第一章"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["isFolder"] is True
    assert body["name"] == "第一章"


async def test_create_folder_duplicate_name_409(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    await client.post(
        f"/materials/resources/{rid}/folders",
        json={"name": "第一章"},
        headers=auth_headers,
    )
    r = await client.post(
        f"/materials/resources/{rid}/folders",
        json={"name": "第一章"},
        headers=auth_headers,
    )
    assert r.status_code == 409


async def test_root_level_duplicate_upload_auto_renamed(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Root-level (parent_id IS NULL) same-name upload auto-renames, never 409.

    A previously stuck-but-successful upload may already hold the name, so a
    re-upload of the same root-level name must succeed as ``讲义 (1).pdf``
    rather than blocking the user with a 409 (folder create still 409s).
    """
    rid = await _create_resource(client, auth_headers)
    await _upload(client, auth_headers, rid, "讲义.pdf", _pdf_bytes(), "application/pdf")
    # Second upload of the same root-level name -> 200 + auto-renamed.
    tree = await _upload(
        client, auth_headers, rid, "讲义.pdf", _pdf_bytes(), "application/pdf"
    )
    names = {n["name"] for n in tree}
    assert names == {"讲义.pdf", "讲义 (1).pdf"}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

async def test_upload_writes_disk_and_url(
    client: AsyncClient,
    auth_headers: dict[str, str],
    _isolate_uploads: Path,
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "讲义.pdf", _pdf_bytes(), "application/pdf"
    )
    node = tree[0]
    assert node["ext"] == "pdf"
    assert node["url"].startswith("http")
    assert f"/uploads/materials/20211010001/{rid}/" in node["url"]
    assert node["sizeBytes"] == len(_pdf_bytes())
    assert node["size"]  # human-readable string present
    # File actually written under the patched root.
    fname = node["url"].rsplit("/", 1)[-1]
    on_disk = _isolate_uploads / "materials" / "20211010001" / rid / fname
    assert on_disk.is_file()


async def test_upload_duplicate_name_auto_renamed(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Uploading the same name twice keeps both: ``x.pdf`` + ``x (1).pdf``.

    Regression for the "stuck-but-successful upload squats the name → re-upload
    409s" bug: uploads must auto-rename (extension preserved, base gets `` (n)``)
    until unique, and a third upload bumps to ``x (2).pdf``.
    """
    rid = await _create_resource(client, auth_headers)
    await _upload(client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf")
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    names = {n["name"] for n in tree}
    # Both files present; second auto-renamed with the extension preserved.
    assert "x.pdf" in names
    assert "x (1).pdf" in names
    assert len([n for n in tree if not n["isFolder"]]) == 2

    # A third upload of the same name bumps to (2).
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    names = {n["name"] for n in tree}
    assert names == {"x.pdf", "x (1).pdf", "x (2).pdf"}


async def test_upload_into_folder(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "第一章"},
            headers=auth_headers,
        )
    ).json()
    tree = await _upload(
        client,
        auth_headers,
        rid,
        "ch1.docx",
        _docx_bytes(),
        "application/octet-stream",
        folder_id=folder["id"],
    )
    flat = _flatten(tree)
    assert "第一章" in flat
    assert flat["第一章"]["children"][0]["name"] == "ch1.docx"


async def test_upload_requires_owner(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
) -> None:
    rid = await _create_resource(client, auth_headers)
    r = await client.post(
        f"/materials/resources/{rid}/files",
        files={"files": ("讲义.pdf", _pdf_bytes(), "application/pdf")},
        headers=second_headers,
    )
    assert r.status_code == 403


async def test_upload_requires_auth(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    r = await client.post(
        f"/materials/resources/{rid}/files",
        files={"files": ("讲义.pdf", _pdf_bytes(), "application/pdf")},
    )
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Rename
# ---------------------------------------------------------------------------

async def test_rename_file_preserves_extension(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "old.pdf", _pdf_bytes(), "application/pdf"
    )
    fid = tree[0]["id"]
    # User types a name without (or with the wrong) extension; .pdf is forced.
    r = await client.patch(
        f"/materials/files/{fid}/rename",
        json={"name": "新讲义"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "新讲义.pdf"

    r2 = await client.patch(
        f"/materials/files/{fid}/rename",
        json={"name": "again.txt"},
        headers=auth_headers,
    )
    assert r2.json()["name"] == "again.pdf"


async def test_rename_folder_verbatim(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "第一章"},
            headers=auth_headers,
        )
    ).json()
    r = await client.patch(
        f"/materials/files/{folder['id']}/rename",
        json={"name": "导论"},
        headers=auth_headers,
    )
    assert r.json()["name"] == "导论"


async def test_rename_non_owner_403(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    r = await client.patch(
        f"/materials/files/{tree[0]['id']}/rename",
        json={"name": "hacked"},
        headers=second_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Reorder (before / after / inside) + ancestor cycle guard
# ---------------------------------------------------------------------------

async def _three_root_files(
    client: AsyncClient, headers: dict[str, str], rid: str
) -> list[dict]:
    for name in ("a.pdf", "b.pdf", "c.pdf"):
        await _upload(client, headers, rid, name, _pdf_bytes(), "application/pdf")
    return (
        await client.get(f"/materials/resources/{rid}/files", headers=headers)
    ).json()


async def test_reorder_before(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    files = await _three_root_files(client, auth_headers, rid)
    a, c = files[0], files[2]
    # Move c before a -> [c, a, b].
    r = await client.post(
        "/materials/files/reorder",
        json={"dragId": c["id"], "dropId": a["id"], "position": "before"},
        headers=auth_headers,
    )
    assert r.status_code == 204, r.text
    after = (
        await client.get(f"/materials/resources/{rid}/files", headers=auth_headers)
    ).json()
    assert [n["name"] for n in after] == ["c.pdf", "a.pdf", "b.pdf"]


async def test_reorder_after(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    files = await _three_root_files(client, auth_headers, rid)
    a, c = files[0], files[2]
    # Move a after c -> [b, c, a].
    r = await client.post(
        "/materials/files/reorder",
        json={"dragId": a["id"], "dropId": c["id"], "position": "after"},
        headers=auth_headers,
    )
    assert r.status_code == 204
    after = (
        await client.get(f"/materials/resources/{rid}/files", headers=auth_headers)
    ).json()
    assert [n["name"] for n in after] == ["b.pdf", "c.pdf", "a.pdf"]


async def test_reorder_inside_changes_parent(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "dir"},
            headers=auth_headers,
        )
    ).json()
    tree = await _upload(
        client, auth_headers, rid, "leaf.pdf", _pdf_bytes(), "application/pdf"
    )
    leaf = next(n for n in tree if n["name"] == "leaf.pdf")
    # Drag leaf inside folder.
    r = await client.post(
        "/materials/files/reorder",
        json={"dragId": leaf["id"], "dropId": folder["id"], "position": "inside"},
        headers=auth_headers,
    )
    assert r.status_code == 204
    after = (
        await client.get(f"/materials/resources/{rid}/files", headers=auth_headers)
    ).json()
    # Root now only has the folder; leaf is its child.
    assert [n["name"] for n in after] == ["dir"]
    assert after[0]["children"][0]["name"] == "leaf.pdf"


async def test_reorder_cycle_guard_400(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Dragging a parent folder *inside* its own descendant must 400."""
    rid = await _create_resource(client, auth_headers)
    parent = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "parent"},
            headers=auth_headers,
        )
    ).json()
    child = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "child", "parentId": parent["id"]},
            headers=auth_headers,
        )
    ).json()
    r = await client.post(
        "/materials/files/reorder",
        json={"dragId": parent["id"], "dropId": child["id"], "position": "inside"},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert "自身" in r.json()["detail"]


async def test_reorder_into_self_400(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "f"},
            headers=auth_headers,
        )
    ).json()
    r = await client.post(
        "/materials/files/reorder",
        json={"dragId": folder["id"], "dropId": folder["id"], "position": "inside"},
        headers=auth_headers,
    )
    assert r.status_code == 400


async def test_reorder_non_owner_403(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
) -> None:
    rid = await _create_resource(client, auth_headers)
    files = await _three_root_files(client, auth_headers, rid)
    r = await client.post(
        "/materials/files/reorder",
        json={
            "dragId": files[0]["id"],
            "dropId": files[1]["id"],
            "position": "before",
        },
        headers=second_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cascade soft-delete + physical unlink
# ---------------------------------------------------------------------------

async def test_delete_file_soft_deletes_and_unlinks(
    client: AsyncClient,
    auth_headers: dict[str, str],
    _isolate_uploads: Path,
    db_session: AsyncSession,
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    fid = tree[0]["id"]
    fname = tree[0]["url"].rsplit("/", 1)[-1]
    on_disk = _isolate_uploads / "materials" / "20211010001" / rid / fname
    assert on_disk.is_file()

    r = await client.delete(f"/materials/files/{fid}", headers=auth_headers)
    assert r.status_code == 204
    # Physically gone.
    assert not on_disk.exists()
    # Soft-deleted in DB (row still present, deleted=True).
    row = await db_session.get(models.MaterialFile, fid)
    assert row is not None and row.deleted is True
    # Vanished from the tree.
    after = (
        await client.get(f"/materials/resources/{rid}/files", headers=auth_headers)
    ).json()
    assert after == []


async def test_delete_folder_cascades_subtree(
    client: AsyncClient,
    auth_headers: dict[str, str],
    _isolate_uploads: Path,
    db_session: AsyncSession,
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "dir"},
            headers=auth_headers,
        )
    ).json()
    tree = await _upload(
        client,
        auth_headers,
        rid,
        "inner.pdf",
        _pdf_bytes(),
        "application/pdf",
        folder_id=folder["id"],
    )
    inner = _flatten(tree)["inner.pdf"]
    fname = inner["url"].rsplit("/", 1)[-1]
    on_disk = _isolate_uploads / "materials" / "20211010001" / rid / fname
    assert on_disk.is_file()

    r = await client.delete(
        f"/materials/folders/{folder['id']}", headers=auth_headers
    )
    assert r.status_code == 204
    # Folder + child both soft-deleted, child blob unlinked.
    assert not on_disk.exists()
    frow = await db_session.get(models.MaterialFile, folder["id"])
    crow = await db_session.get(models.MaterialFile, inner["id"])
    assert frow.deleted is True
    assert crow.deleted is True
    after = (
        await client.get(f"/materials/resources/{rid}/files", headers=auth_headers)
    ).json()
    assert after == []


async def test_delete_resource_cascades(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_headers: dict[str, str],
    _isolate_uploads: Path,
    db_session: AsyncSession,
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    fname = tree[0]["url"].rsplit("/", 1)[-1]
    on_disk = _isolate_uploads / "materials" / "20211010001" / rid / fname

    # Non-owner cannot delete.
    r = await client.delete(
        f"/materials/resources/{rid}", headers=second_headers
    )
    assert r.status_code == 403

    r = await client.delete(f"/materials/resources/{rid}", headers=auth_headers)
    assert r.status_code == 204
    assert not on_disk.exists()
    # Resource no longer listed / fetchable.
    assert (await client.get(f"/materials/resources/{rid}")).status_code == 404
    rows_present = await db_session.get(models.MaterialResource, rid)
    assert rows_present.deleted is True


async def test_delete_file_requires_auth(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "x.pdf", _pdf_bytes(), "application/pdf"
    )
    r = await client.delete(f"/materials/files/{tree[0]['id']}")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

async def test_download_streams_with_content_disposition(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    tree = await _upload(
        client, auth_headers, rid, "讲义.pdf", _pdf_bytes(), "application/pdf"
    )
    fid = tree[0]["id"]
    r = await client.get(f"/materials/files/{fid}/download")
    assert r.status_code == 200, r.text
    assert r.content == _pdf_bytes()
    cd = r.headers["content-disposition"]
    assert "attachment" in cd
    # UTF-8 RFC 5987 form for the non-ASCII name.
    assert "filename*=UTF-8''" in cd
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_download_folder_400(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    rid = await _create_resource(client, auth_headers)
    folder = (
        await client.post(
            f"/materials/resources/{rid}/folders",
            json={"name": "dir"},
            headers=auth_headers,
        )
    ).json()
    r = await client.get(f"/materials/files/{folder['id']}/download")
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Acknowledgment notice (the credits bar on the materials list page)
# ---------------------------------------------------------------------------

async def test_notice_default_empty_when_unset(client: AsyncClient) -> None:
    """No row yet (tests skip the migration seed) → empty + hidden, shared read."""
    r = await client.get("/materials/notice")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["content"] == ""
    assert body["visible"] is False
    assert "updateDate" in body


async def test_put_notice_admin_creates_and_shows(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    r = await client.put(
        "/materials/notice",
        json={"content": "  致谢 黄耀增学长 https://github.com/XJU-OpenHub/XjuCsMajorResources  "},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # content is trimmed; bar becomes visible.
    assert body["content"].startswith("致谢 黄耀增学长")
    assert body["visible"] is True
    # GET reflects it for everyone (shared read).
    got = (await client.get("/materials/notice")).json()
    assert got["content"] == body["content"]
    assert got["visible"] is True


async def test_put_notice_requires_auth(client: AsyncClient) -> None:
    r = await client.put("/materials/notice", json={"content": "x"})
    assert r.status_code == 401


async def test_put_notice_non_admin_403(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.put(
        "/materials/notice", json={"content": "x"}, headers=auth_headers
    )
    assert r.status_code == 403


async def test_put_notice_blank_422(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    r = await client.put(
        "/materials/notice", json={"content": "   "}, headers=admin_headers
    )
    assert r.status_code == 422


async def test_delete_notice_hides_but_keeps_content(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    await client.put(
        "/materials/notice", json={"content": "致谢内容"}, headers=admin_headers
    )
    r = await client.delete("/materials/notice", headers=admin_headers)
    assert r.status_code == 204, r.text
    got = (await client.get("/materials/notice")).json()
    assert got["visible"] is False
    # content kept so a later PUT restores without re-typing.
    assert got["content"] == "致谢内容"
    # admin PUT restores visibility.
    r2 = await client.put(
        "/materials/notice", json={"content": "致谢内容"}, headers=admin_headers
    )
    assert r2.json()["visible"] is True


async def test_delete_notice_non_admin_403(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.delete("/materials/notice", headers=auth_headers)
    assert r.status_code == 403
