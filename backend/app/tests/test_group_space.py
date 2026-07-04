"""组内空间 tests — file upload/download/delete + 甘特 task CRUD.

Covers: member-only access (non-member 403, 班委 override), the shared
save_upload pipeline (magic sniff via a real minimal PDF), download headers
(RFC 5987 attachment + nosniff), delete permissions (uploader vs other
member vs leader) + physical unlink, task validation (assignee ⊆ members,
date ordering on create=422 / patch=400), replace-all assignee semantics,
progress bounds, and creator/manager delete rules.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.services import groups as groups_svc

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture(autouse=True)
def _isolate_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "uploads"
    monkeypatch.setattr(groups_svc, "UPLOAD_ROOT", root)
    monkeypatch.setattr(groups_svc, "GROUPS_DIR", root / "groups")
    return root


@pytest.fixture
async def group_space(client: AsyncClient, class_setup, login, db_session) -> dict:
    """A group with leader=成员乙(1002) + member=成员丙(1003), via the API.

    `outsider` is a *plain* classmate outside the group — deliberately not
    the admin/committee accounts, whose overrides would defeat the 403
    assertions.
    """
    from app.db import models
    from app.services.auth import hash_password

    db_session.add(
        models.User(
            sid="20240001005",
            name="成员丁",
            nickname="成员丁",
            password_hash=hash_password("123456"),
            class_id=class_setup["demo_class"].id,
        )
    )
    await db_session.commit()

    leader = await login("20240001002")
    member = await login("20240001003")
    outsider = await login("20240001005")  # plain class member, NOT in the group
    committee = await login("20240001001")
    r = await client.post(
        "/classes/me/groups", json={"name": "空间组"}, headers=leader
    )
    assert r.status_code == 201, r.text
    gid = r.json()["id"]
    req = (
        await client.post(f"/groups/{gid}/join-requests", json={}, headers=member)
    ).json()
    await client.post(f"/groups/{gid}/join-requests/{req['id']}/approve", headers=leader)
    return {
        "gid": gid,
        "leader": leader,
        "member": member,
        "outsider": outsider,
        "committee": committee,
    }


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------


async def upload_pdf(
    client: AsyncClient, gid: str, headers: dict, name: str = "需求文档.pdf"
):
    return await client.post(
        f"/groups/{gid}/files",
        files=[("files", (name, PDF_BYTES, "application/pdf"))],
        headers=headers,
    )


async def test_file_upload_and_list(client: AsyncClient, group_space, _isolate_uploads) -> None:
    gid = group_space["gid"]
    r = await upload_pdf(client, gid, group_space["member"])
    assert r.status_code == 200, r.text
    files = r.json()
    assert len(files) == 1
    f = files[0]
    assert f["name"] == "需求文档.pdf"
    assert f["ext"] == "pdf"
    assert f["uploadedBySid"] == "20240001003"
    assert f["uploadedByNickname"] == "成员丙"
    assert f["sizeBytes"] == len(PDF_BYTES)
    assert f["size"] is not None
    assert f"/uploads/groups/{gid}/" in f["url"]
    assert len(list((_isolate_uploads / "groups" / gid).iterdir())) == 1

    # Non-member class member is locked out; 班委 gets the override.
    assert (
        await client.get(f"/groups/{gid}/files", headers=group_space["outsider"])
    ).status_code == 403
    r = await client.get(f"/groups/{gid}/files", headers=group_space["committee"])
    assert r.status_code == 200 and len(r.json()) == 1


async def test_file_upload_non_member_403(client: AsyncClient, group_space) -> None:
    r = await upload_pdf(client, group_space["gid"], group_space["outsider"])
    assert r.status_code == 403


async def test_file_type_rejected(client: AsyncClient, group_space) -> None:
    r = await client.post(
        f"/groups/{group_space['gid']}/files",
        files=[("files", ("evil.svg", b"<svg/>", "image/svg+xml"))],
        headers=group_space["member"],
    )
    assert r.status_code == 400


async def test_file_download_headers(client: AsyncClient, group_space) -> None:
    gid = group_space["gid"]
    fid = (await upload_pdf(client, gid, group_space["leader"])).json()[0]["id"]

    r = await client.get(f"/groups/{gid}/files/{fid}/download", headers=group_space["member"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    disposition = r.headers["content-disposition"]
    assert disposition.startswith("attachment;")
    assert "filename*=UTF-8''" in disposition
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.content == PDF_BYTES

    r = await client.get(f"/groups/{gid}/files/{fid}/download", headers=group_space["outsider"])
    assert r.status_code == 403


async def test_file_delete_permissions(
    client: AsyncClient, group_space, _isolate_uploads
) -> None:
    gid = group_space["gid"]
    fid = (await upload_pdf(client, gid, group_space["leader"])).json()[0]["id"]

    # Another member can't delete the leader's file…
    r = await client.delete(f"/groups/{gid}/files/{fid}", headers=group_space["member"])
    assert r.status_code == 403
    # …the uploader can, and the blob is unlinked.
    r = await client.delete(f"/groups/{gid}/files/{fid}", headers=group_space["leader"])
    assert r.status_code == 204
    assert (await client.get(f"/groups/{gid}/files", headers=group_space["leader"])).json() == []
    assert list((_isolate_uploads / "groups" / gid).iterdir()) == []

    # A member's own file can be removed by the leader (manager rule).
    fid = (await upload_pdf(client, gid, group_space["member"])).json()[0]["id"]
    r = await client.delete(f"/groups/{gid}/files/{fid}", headers=group_space["leader"])
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# Tasks (甘特)
# ---------------------------------------------------------------------------


TASK = {
    "title": "需求分析",
    "assigneeSids": ["20240001003"],
    "startDate": "2026-07-06",
    "endDate": "2026-07-10",
    "status": "doing",
    "progress": 30,
}


async def test_task_create_and_list(client: AsyncClient, group_space) -> None:
    gid = group_space["gid"]
    r = await client.post(f"/groups/{gid}/tasks", json=TASK, headers=group_space["member"])
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["title"] == "需求分析"
    assert task["assigneeSids"] == ["20240001003"]
    assert task["assignees"][0]["nickname"] == "成员丙"
    assert task["startDate"] == "2026-07-06"
    assert task["endDate"] == "2026-07-10"
    assert task["createdBySid"] == "20240001003"

    # Ordered by startDate.
    earlier = {**TASK, "title": "更早的任务", "startDate": "2026-07-01", "endDate": "2026-07-02"}
    await client.post(f"/groups/{gid}/tasks", json=earlier, headers=group_space["leader"])
    titles = [
        t["title"]
        for t in (await client.get(f"/groups/{gid}/tasks", headers=group_space["leader"])).json()
    ]
    assert titles == ["更早的任务", "需求分析"]

    # Outsider can't read or write tasks.
    assert (
        await client.get(f"/groups/{gid}/tasks", headers=group_space["outsider"])
    ).status_code == 403


async def test_task_validation(client: AsyncClient, group_space) -> None:
    gid = group_space["gid"]
    leader = group_space["leader"]

    bad_assignee = {**TASK, "assigneeSids": ["20240001004"]}  # not a member
    r = await client.post(f"/groups/{gid}/tasks", json=bad_assignee, headers=leader)
    assert r.status_code == 400

    bad_dates = {**TASK, "startDate": "2026-07-10", "endDate": "2026-07-06"}
    r = await client.post(f"/groups/{gid}/tasks", json=bad_dates, headers=leader)
    assert r.status_code == 422  # schema-level model_validator

    bad_progress = {**TASK, "progress": 101}
    r = await client.post(f"/groups/{gid}/tasks", json=bad_progress, headers=leader)
    assert r.status_code == 422


async def test_task_patch_merge_and_assignee_replace(
    client: AsyncClient, group_space
) -> None:
    gid = group_space["gid"]
    leader = group_space["leader"]
    tid = (await client.post(f"/groups/{gid}/tasks", json=TASK, headers=leader)).json()["id"]

    # Drag-move: both dates shift.
    r = await client.patch(
        f"/groups/{gid}/tasks/{tid}",
        json={"startDate": "2026-07-08", "endDate": "2026-07-12"},
        headers=leader,
    )
    assert r.status_code == 200, r.text
    assert (r.json()["startDate"], r.json()["endDate"]) == ("2026-07-08", "2026-07-12")

    # A partial date PATCH that crosses the *other* stored date → 400.
    r = await client.patch(
        f"/groups/{gid}/tasks/{tid}", json={"endDate": "2026-07-07"}, headers=leader
    )
    assert r.status_code == 400

    # Replace-all assignees (both members), then clear with [].
    r = await client.patch(
        f"/groups/{gid}/tasks/{tid}",
        json={"assigneeSids": ["20240001002", "20240001003"]},
        headers=leader,
    )
    assert r.json()["assigneeSids"] == ["20240001002", "20240001003"]
    r = await client.patch(
        f"/groups/{gid}/tasks/{tid}", json={"assigneeSids": []}, headers=leader
    )
    assert r.json()["assigneeSids"] == []

    # Status/progress edits (done at 100 is the dialog's convention).
    r = await client.patch(
        f"/groups/{gid}/tasks/{tid}",
        json={"status": "done", "progress": 100},
        headers=leader,
    )
    assert (r.json()["status"], r.json()["progress"]) == ("done", 100)


async def test_task_delete_rules(client: AsyncClient, group_space) -> None:
    gid = group_space["gid"]
    leader, member = group_space["leader"], group_space["member"]

    tid = (await client.post(f"/groups/{gid}/tasks", json=TASK, headers=leader)).json()["id"]
    # Another member can't delete the leader's task…
    r = await client.delete(f"/groups/{gid}/tasks/{tid}", headers=member)
    assert r.status_code == 403
    # …its creator can.
    r = await client.delete(f"/groups/{gid}/tasks/{tid}", headers=leader)
    assert r.status_code == 204

    # The leader (manager) may delete a member's task.
    tid = (await client.post(f"/groups/{gid}/tasks", json=TASK, headers=member)).json()["id"]
    r = await client.delete(f"/groups/{gid}/tasks/{tid}", headers=leader)
    assert r.status_code == 204
    assert (await client.get(f"/groups/{gid}/tasks", headers=leader)).json() == []
