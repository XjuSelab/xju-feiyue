"""/groups/* lifecycle tests — 建组, 申请加入, 审批, 成员管理, logo.

Covers: creator-becomes-组长, per-class name 409, the one-live-group rule,
the join-request flow (apply → approve/reject/cancel, auto-reject of other
pendings, concurrent-decision 409), leave/remove/transfer-leader rules,
manager-only meta writes (组长 / 班委 / admin), soft-delete freeing members,
logo upload (PIL thumbnail), and cross-class 404 isolation.
"""

from __future__ import annotations

import io
from pathlib import Path

import pytest
from httpx import AsyncClient
from PIL import Image

from app.services import groups as groups_svc


@pytest.fixture(autouse=True)
def _isolate_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "uploads"
    monkeypatch.setattr(groups_svc, "UPLOAD_ROOT", root)
    monkeypatch.setattr(groups_svc, "GROUPS_DIR", root / "groups")
    return root


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 30, 30)).save(buf, "PNG")
    return buf.getvalue()


async def create_group(client: AsyncClient, headers: dict, name: str = "冲冲冲小组") -> dict:
    r = await client.post(
        "/classes/me/groups", json={"name": name, "intro": "一起做课设"}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_create_group_creator_is_leader(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240001002")  # member1
    body = await create_group(client, headers)
    assert body["leaderSid"] == "20240001002"
    assert body["leaderNickname"] == "成员乙"
    assert body["myRole"] == "leader"
    assert body["memberCount"] == 1
    assert body["intro"] == "一起做课设"

    detail = (await client.get(f"/groups/{body['id']}", headers=headers)).json()
    assert [m["role"] for m in detail["members"]] == ["leader"]


async def test_create_group_duplicate_name_409(client: AsyncClient, class_setup, login) -> None:
    await create_group(client, await login("20240001002"), "同名组")
    r = await client.post(
        "/classes/me/groups", json={"name": "同名组"}, headers=await login("20240001003")
    )
    assert r.status_code == 409


async def test_one_live_group_per_user(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240001002")
    await create_group(client, headers, "第一组")
    r = await client.post("/classes/me/groups", json={"name": "第二组"}, headers=headers)
    assert r.status_code == 409

    # …but after 解散 the member is freed.
    gid = (await client.get("/classes/me/groups", headers=headers)).json()[0]["id"]
    assert (await client.delete(f"/groups/{gid}", headers=headers)).status_code == 204
    r = await client.post("/classes/me/groups", json={"name": "第二组"}, headers=headers)
    assert r.status_code == 201


async def test_group_list_and_cross_class_isolation(
    client: AsyncClient, class_setup, login
) -> None:
    headers = await login("20240001002")
    body = await create_group(client, headers)

    other = await login("20240002001")  # 外班班委
    assert (await client.get("/classes/me/groups", headers=other)).json() == []
    assert (await client.get(f"/groups/{body['id']}", headers=other)).status_code == 404

    classless = await login("20240003001")
    assert (await client.get("/classes/me/groups", headers=classless)).status_code == 403


async def test_join_request_flow_approve(client: AsyncClient, class_setup, login) -> None:
    leader = await login("20240001002")
    applicant = await login("20240001003")
    gid = (await create_group(client, leader))["id"]

    r = await client.post(
        f"/groups/{gid}/join-requests", json={"message": "带我一个"}, headers=applicant
    )
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["status"] == "pending"
    assert req["nickname"] == "成员丙"

    # Duplicate pending → 409; applicant sees the button state via list field.
    r = await client.post(f"/groups/{gid}/join-requests", json={}, headers=applicant)
    assert r.status_code == 409
    listed = (await client.get("/classes/me/groups", headers=applicant)).json()[0]
    assert listed["myPendingRequestId"] == req["id"]
    assert listed["myRole"] is None

    # Plain outsiders can't read the queue; the leader can.
    assert (
        await client.get(f"/groups/{gid}/join-requests", headers=applicant)
    ).status_code == 403
    queue = (await client.get(f"/groups/{gid}/join-requests", headers=leader)).json()
    assert [q["id"] for q in queue] == [req["id"]]

    r = await client.post(f"/groups/{gid}/join-requests/{req['id']}/approve", headers=leader)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"

    detail = (await client.get(f"/groups/{gid}", headers=applicant)).json()
    assert detail["myRole"] == "member"
    assert detail["memberCount"] == 2

    # Deciding twice → 409 (concurrent managers).
    r = await client.post(f"/groups/{gid}/join-requests/{req['id']}/approve", headers=leader)
    assert r.status_code == 409


async def test_approve_auto_rejects_other_pendings(
    client: AsyncClient, class_setup, login
) -> None:
    leader1 = await login("20240001002")
    leader2 = await login("20240001001")  # committee doubles as another leader
    applicant = await login("20240001003")
    gid1 = (await create_group(client, leader1, "甲组"))["id"]
    gid2 = (await create_group(client, leader2, "乙组"))["id"]

    r1 = (await client.post(f"/groups/{gid1}/join-requests", json={}, headers=applicant)).json()
    r2 = (await client.post(f"/groups/{gid2}/join-requests", json={}, headers=applicant)).json()

    await client.post(f"/groups/{gid1}/join-requests/{r1['id']}/approve", headers=leader1)

    queue2 = (
        await client.get(f"/groups/{gid2}/join-requests?status=rejected", headers=leader2)
    ).json()
    assert [q["id"] for q in queue2] == [r2["id"]]

    # And the (now group-bound) applicant can no longer apply anywhere.
    r = await client.post(f"/groups/{gid2}/join-requests", json={}, headers=applicant)
    assert r.status_code == 409


async def test_reject_and_cancel(client: AsyncClient, class_setup, login) -> None:
    leader = await login("20240001002")
    applicant = await login("20240001003")
    # 班委 has approve/reject powers but may NOT cancel someone else's request.
    third = await login("20240001001")
    gid = (await create_group(client, leader))["id"]

    req = (await client.post(f"/groups/{gid}/join-requests", json={}, headers=applicant)).json()
    r = await client.post(f"/groups/{gid}/join-requests/{req['id']}/reject", headers=leader)
    assert r.json()["status"] == "rejected"

    # After a reject the applicant may apply again, then cancel their own.
    req2 = (await client.post(f"/groups/{gid}/join-requests", json={}, headers=applicant)).json()
    r = await client.delete(f"/groups/{gid}/join-requests/{req2['id']}", headers=third)
    assert r.status_code == 403
    r = await client.delete(f"/groups/{gid}/join-requests/{req2['id']}", headers=applicant)
    assert r.status_code == 204
    queue = (
        await client.get(f"/groups/{gid}/join-requests?status=pending", headers=leader)
    ).json()
    assert queue == []


async def test_committee_can_approve(client: AsyncClient, class_setup, login) -> None:
    """班委 (not a member of the group) may manage its join queue."""
    leader = await login("20240001003")
    committee = await login("20240001001")
    applicant = await login("20240001004")
    gid = (await create_group(client, leader))["id"]
    req = (await client.post(f"/groups/{gid}/join-requests", json={}, headers=applicant)).json()
    r = await client.post(f"/groups/{gid}/join-requests/{req['id']}/approve", headers=committee)
    assert r.status_code == 200, r.text


async def test_leave_remove_and_transfer(client: AsyncClient, class_setup, login) -> None:
    leader = await login("20240001002")
    member = await login("20240001003")
    gid = (await create_group(client, leader))["id"]
    req = (await client.post(f"/groups/{gid}/join-requests", json={}, headers=member)).json()
    await client.post(f"/groups/{gid}/join-requests/{req['id']}/approve", headers=leader)

    # A member cannot remove someone else.
    r = await client.delete(f"/groups/{gid}/members/20240001002", headers=member)
    assert r.status_code == 403
    # The leader cannot leave (or be removed) without transferring first.
    r = await client.delete(f"/groups/{gid}/members/20240001002", headers=leader)
    assert r.status_code == 400

    # Transfer to a non-member → 404; to the member → roles swap.
    r = await client.post(
        f"/groups/{gid}/transfer-leader", json={"sid": "20240001004"}, headers=leader
    )
    assert r.status_code == 404
    r = await client.post(
        f"/groups/{gid}/transfer-leader", json={"sid": "20240001003"}, headers=leader
    )
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["leaderSid"] == "20240001003"
    roles = {m["sid"]: m["role"] for m in detail["members"]}
    assert roles == {"20240001002": "member", "20240001003": "leader"}

    # The old leader (now member) can leave.
    r = await client.delete(f"/groups/{gid}/members/20240001002", headers=leader)
    assert r.status_code == 204
    detail = (await client.get(f"/groups/{gid}", headers=member)).json()
    assert detail["memberCount"] == 1


async def test_meta_writes_manager_only(client: AsyncClient, class_setup, login) -> None:
    leader = await login("20240001002")
    outsider = await login("20240001003")
    committee = await login("20240001001")
    gid = (await create_group(client, leader))["id"]

    r = await client.patch(f"/groups/{gid}", json={"intro": "改简介"}, headers=outsider)
    assert r.status_code == 403
    r = await client.patch(f"/groups/{gid}", json={"intro": "改简介"}, headers=leader)
    assert r.json()["intro"] == "改简介"
    r = await client.patch(f"/groups/{gid}", json={"name": "新组名"}, headers=committee)
    assert r.json()["name"] == "新组名"

    # Renaming onto another live group's name → 409.
    await create_group(client, await login("20240001003"), "占位组")
    r = await client.patch(f"/groups/{gid}", json={"name": "占位组"}, headers=leader)
    assert r.status_code == 409


async def test_logo_upload(client: AsyncClient, class_setup, login, _isolate_uploads) -> None:
    leader = await login("20240001002")
    member = await login("20240001003")
    gid = (await create_group(client, leader))["id"]

    files = {"file": ("logo.png", png_bytes(), "image/png")}
    r = await client.post(f"/groups/{gid}/logo", files=files, headers=member)
    assert r.status_code == 403

    r = await client.post(f"/groups/{gid}/logo", files=files, headers=leader)
    assert r.status_code == 200, r.text
    body = r.json()
    assert f"/uploads/groups/{gid}/" in body["logo"]
    assert body["logoThumb"].endswith(".thumb.jpg")
    stored = list((_isolate_uploads / "groups" / gid).iterdir())
    assert len(stored) == 2  # original + thumbnail

    bad = {"file": ("evil.txt", b"not an image", "text/plain")}
    r = await client.post(f"/groups/{gid}/logo", files=bad, headers=leader)
    assert r.status_code == 400
