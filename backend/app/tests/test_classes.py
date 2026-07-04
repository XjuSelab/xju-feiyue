"""/classes/me/* route tests — class card, member list, 点名 (roll-call).

Covers: 200-with-nulls for classless users, member-list class scoping,
roll-call create permission (班委 / in-class admin only), the roster
snapshot, per-record upsert (incl. a member who joined after the snapshot),
close/reopen/title PATCH, DELETE cascade, and cross-class isolation.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.services.auth import hash_password


async def test_classes_me_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/classes/me")
    assert r.status_code == 401


async def test_classes_me_classless_returns_nulls(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240003001")  # classless
    r = await client.get("/classes/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["classId"] is None
    assert body["classFullName"] is None
    assert body["classShortName"] is None
    assert body["isClassCommittee"] is False
    assert body["memberCount"] == 0


async def test_classes_me_member(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240001002")  # member1
    r = await client.get("/classes/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["classFullName"] == "计算机科学与技术24-3"
    assert body["classShortName"] == "计算机24-3"
    assert body["isClassCommittee"] is False
    assert body["memberCount"] == 4  # committee + member1 + member2 + admin_member


async def test_classes_me_committee_flag(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240001001")  # committee
    r = await client.get("/classes/me", headers=headers)
    assert r.json()["isClassCommittee"] is True


async def test_members_scoped_to_own_class(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240001002")
    r = await client.get("/classes/me/members", headers=headers)
    assert r.status_code == 200
    sids = [m["sid"] for m in r.json()]
    assert sids == ["20240001001", "20240001002", "20240001003", "20240001004"]
    # 外班班委 never appears; the committee flag rides along.
    by_sid = {m["sid"]: m for m in r.json()}
    assert by_sid["20240001001"]["isClassCommittee"] is True
    assert by_sid["20240001002"]["isClassCommittee"] is False


async def test_members_classless_403(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240003001")
    r = await client.get("/classes/me/members", headers=headers)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Roll-call
# ---------------------------------------------------------------------------


async def test_rollcall_create_requires_committee(
    client: AsyncClient, class_setup, login
) -> None:
    member_headers = await login("20240001002")
    r = await client.post("/classes/me/rollcalls", json={}, headers=member_headers)
    assert r.status_code == 403


async def test_rollcall_create_snapshots_roster(
    client: AsyncClient, class_setup, login
) -> None:
    headers = await login("20240001001")  # committee
    r = await client.post(
        "/classes/me/rollcalls", json={"title": "软件工程第3周"}, headers=headers
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "软件工程第3周"
    assert body["createdBySid"] == "20240001001"
    assert body["createdByNickname"] == "班委甲"
    assert body["closedAt"] is None
    assert body["totalCount"] == 4
    assert body["presentCount"] == 0
    assert len(body["records"]) == 4
    assert all(rec["present"] is False for rec in body["records"])


async def test_rollcall_admin_member_can_create(
    client: AsyncClient, class_setup, login
) -> None:
    """A site admin who belongs to the class may run roll-call (override)."""
    headers = await login("20240001004")  # admin_member (role=admin, not 班委)
    r = await client.post("/classes/me/rollcalls", json={}, headers=headers)
    assert r.status_code == 201, r.text


async def test_rollcall_record_toggle_and_counts(
    client: AsyncClient, class_setup, login
) -> None:
    committee = await login("20240001001")
    member = await login("20240001002")
    session_id = (
        await client.post("/classes/me/rollcalls", json={}, headers=committee)
    ).json()["id"]

    # Plain member cannot check.
    r = await client.put(
        f"/classes/me/rollcalls/{session_id}/records/20240001002",
        json={"present": True},
        headers=member,
    )
    assert r.status_code == 403

    # Committee checks member1 present.
    r = await client.put(
        f"/classes/me/rollcalls/{session_id}/records/20240001002",
        json={"present": True},
        headers=committee,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["present"] is True
    assert body["nickname"] == "成员乙"
    assert body["checkedAt"] is not None

    detail = (
        await client.get(f"/classes/me/rollcalls/{session_id}", headers=committee)
    ).json()
    assert detail["presentCount"] == 1

    # Un-check (fix-up) works too.
    r = await client.put(
        f"/classes/me/rollcalls/{session_id}/records/20240001002",
        json={"present": False},
        headers=committee,
    )
    assert r.json()["present"] is False

    # Members can *view* the detail (history transparency).
    r = await client.get(f"/classes/me/rollcalls/{session_id}", headers=member)
    assert r.status_code == 200


async def test_rollcall_record_target_must_be_classmate(
    client: AsyncClient, class_setup, login
) -> None:
    committee = await login("20240001001")
    session_id = (
        await client.post("/classes/me/rollcalls", json={}, headers=committee)
    ).json()["id"]
    for target in ("20240002001", "20240003001", "99999999999"):
        r = await client.put(
            f"/classes/me/rollcalls/{session_id}/records/{target}",
            json={"present": True},
            headers=committee,
        )
        assert r.status_code == 404, target


async def test_rollcall_upsert_for_late_joiner(
    client: AsyncClient, class_setup, login, db_session: AsyncSession
) -> None:
    """A student assigned to the class *after* the snapshot is still checkable."""
    committee = await login("20240001001")
    session_id = (
        await client.post("/classes/me/rollcalls", json={}, headers=committee)
    ).json()["id"]

    late = models.User(
        sid="20240001005",
        name="迟到丁",
        nickname="迟到丁",
        password_hash=hash_password("123456"),
        class_id=class_setup["demo_class"].id,
    )
    db_session.add(late)
    await db_session.commit()

    r = await client.put(
        f"/classes/me/rollcalls/{session_id}/records/20240001005",
        json={"present": True},
        headers=committee,
    )
    assert r.status_code == 200, r.text
    detail = (
        await client.get(f"/classes/me/rollcalls/{session_id}", headers=committee)
    ).json()
    assert detail["totalCount"] == 5
    assert detail["presentCount"] == 1


async def test_rollcall_close_reopen_and_title(
    client: AsyncClient, class_setup, login
) -> None:
    committee = await login("20240001001")
    session_id = (
        await client.post("/classes/me/rollcalls", json={}, headers=committee)
    ).json()["id"]

    r = await client.patch(
        f"/classes/me/rollcalls/{session_id}", json={"closed": True}, headers=committee
    )
    assert r.status_code == 200
    assert r.json()["closedAt"] is not None

    # Records stay editable after close (fix-up requirement).
    r = await client.put(
        f"/classes/me/rollcalls/{session_id}/records/20240001002",
        json={"present": True},
        headers=committee,
    )
    assert r.status_code == 200

    r = await client.patch(
        f"/classes/me/rollcalls/{session_id}",
        json={"closed": False, "title": "改名"},
        headers=committee,
    )
    assert r.json()["closedAt"] is None
    assert r.json()["title"] == "改名"


async def test_rollcall_history_scoped_and_ordered(
    client: AsyncClient, class_setup, login
) -> None:
    committee = await login("20240001001")
    other = await login("20240002001")  # 外班班委 runs one in their own class
    first = (await client.post("/classes/me/rollcalls", json={}, headers=committee)).json()
    second = (await client.post("/classes/me/rollcalls", json={}, headers=committee)).json()
    await client.post("/classes/me/rollcalls", json={}, headers=other)

    r = await client.get("/classes/me/rollcalls", headers=committee)
    ids = [s["id"] for s in r.json()]
    assert set(ids) == {first["id"], second["id"]}  # cross-class isolated

    r = await client.get("/classes/me/rollcalls", headers=other)
    assert len(r.json()) == 1
    assert r.json()[0]["totalCount"] == 1  # 信安24-2 has a single member

    # Cross-class detail access is a 404 (undiscoverable).
    r = await client.get(f"/classes/me/rollcalls/{first['id']}", headers=other)
    assert r.status_code == 404


async def test_rollcall_delete_cascades_records(
    client: AsyncClient, class_setup, login, db_session: AsyncSession
) -> None:
    committee = await login("20240001001")
    member = await login("20240001002")
    session_id = (
        await client.post("/classes/me/rollcalls", json={}, headers=committee)
    ).json()["id"]

    r = await client.delete(f"/classes/me/rollcalls/{session_id}", headers=member)
    assert r.status_code == 403

    r = await client.delete(f"/classes/me/rollcalls/{session_id}", headers=committee)
    assert r.status_code == 204
    r = await client.get(f"/classes/me/rollcalls/{session_id}", headers=committee)
    assert r.status_code == 404
    left = (
        await db_session.execute(
            select(func.count())
            .select_from(models.RollCallRecord)
            .where(models.RollCallRecord.session_id == session_id)
        )
    ).scalar_one()
    assert left == 0


async def test_rollcall_classless_403(client: AsyncClient, class_setup, login) -> None:
    headers = await login("20240003001")
    assert (await client.get("/classes/me/rollcalls", headers=headers)).status_code == 403
    assert (
        await client.post("/classes/me/rollcalls", json={}, headers=headers)
    ).status_code == 403


@pytest.mark.parametrize("path", ["/classes/me/members", "/classes/me/rollcalls"])
async def test_unauthenticated_401(client: AsyncClient, path: str) -> None:
    assert (await client.get(path)).status_code == 401


# ---------------------------------------------------------------------------
# 班内设置班委（成员右键入口）
# ---------------------------------------------------------------------------


@pytest.fixture
async def super_in_class(db_session: AsyncSession, class_setup) -> models.User:
    """The bootstrap super-admin (settings.admin_sid) as a demo-class member."""
    user = models.User(
        sid="20241401231",  # settings.admin_sid → 运行时恒为 superadmin
        name="超管同学",
        nickname="超管同学",
        password_hash=hash_password("123456"),
        class_id=class_setup["demo_class"].id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def test_member_committee_permission_ladder(
    client: AsyncClient, class_setup, super_in_class, login
) -> None:
    superadmin = await login("20241401231")
    member = await login("20240001002")
    generic_committee = await login("20240001001")  # 班委甲：无职务，非班长

    url = "/classes/me/members/{sid}/committee"

    # 普通成员 / 无「班长」职务的班委：403。
    body = {"isClassCommittee": True, "committeeTitle": "学习委员"}
    assert (
        await client.post(url.format(sid="20240001003"), json=body, headers=member)
    ).status_code == 403
    assert (
        await client.post(url.format(sid="20240001003"), json=body, headers=generic_committee)
    ).status_code == 403

    # 超管授予 班委甲「班长」。
    r = await client.post(
        url.format(sid="20240001001"),
        json={"isClassCommittee": True, "committeeTitle": "班长"},
        headers=superadmin,
    )
    assert r.status_code == 200, r.text
    assert r.json()["committeeTitle"] == "班长"

    banzhang = generic_committee  # 同一账号，现在是班长
    # 班长可设普通班委职务…
    r = await client.post(
        url.format(sid="20240001002"),
        json={"isClassCommittee": True, "committeeTitle": "学习委员"},
        headers=banzhang,
    )
    assert r.status_code == 200, r.text
    assert r.json()["committeeTitle"] == "学习委员"

    # …但不能授予「班长」，也不能动现任班长。
    r = await client.post(
        url.format(sid="20240001003"),
        json={"isClassCommittee": True, "committeeTitle": "班长"},
        headers=banzhang,
    )
    assert r.status_code == 403
    r = await client.post(
        url.format(sid="20240001001"),
        json={"isClassCommittee": False},
        headers=banzhang,
    )
    assert r.status_code == 403

    # 班长可撤销普通班委（职务随之清空）。
    r = await client.post(
        url.format(sid="20240001002"), json={"isClassCommittee": False}, headers=banzhang
    )
    assert r.status_code == 200
    assert r.json()["isClassCommittee"] is False
    assert r.json()["committeeTitle"] is None

    # 目标必须是本班同学。
    r = await client.post(
        url.format(sid="20240002001"), json=body, headers=superadmin
    )
    assert r.status_code == 404
