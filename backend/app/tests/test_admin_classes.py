"""/admin 班级-management tests — class CRUD + user class/班委 assignment.

Covers: the 404-for-non-admin gate, class list counts, create/rename dup
409, delete-nonempty 409, set-user-class (clearing also drops the 班委
flag), set-committee (400 without a class), the new AdminUserRow fields,
and create-user-with-classId.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_admin_classes_hidden_from_regular_users(
    client: AsyncClient, class_setup, login
) -> None:
    headers = await login("20240001002")
    assert (await client.get("/admin/classes", headers=headers)).status_code == 404


async def test_class_list_counts(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    r = await client.get("/admin/classes", headers=admin)
    assert r.status_code == 200, r.text
    by_short = {c["shortName"]: c for c in r.json()}
    assert by_short["计算机24-3"]["studentCount"] == 4
    assert by_short["计算机24-3"]["committeeCount"] == 1
    assert by_short["信安24-2"]["studentCount"] == 1


async def test_class_create_and_dup(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    r = await client.post(
        "/admin/classes",
        json={"fullName": "软件工程24-1", "shortName": "软工24-1"},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    assert r.json()["studentCount"] == 0

    # Either colliding name → 409.
    for body in (
        {"fullName": "软件工程24-1", "shortName": "别名"},
        {"fullName": "别名全称", "shortName": "软工24-1"},
    ):
        assert (await client.post("/admin/classes", json=body, headers=admin)).status_code == 409


async def test_class_rename_flows_to_users(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    cid = class_setup["demo_class"].id
    r = await client.patch(
        f"/admin/classes/{cid}", json={"shortName": "计科24-3"}, headers=admin
    )
    assert r.status_code == 200, r.text
    assert r.json()["shortName"] == "计科24-3"

    # The FK means members see the new name immediately.
    member = await login("20240001002")
    me = (await client.get("/classes/me", headers=member)).json()
    assert me["classShortName"] == "计科24-3"

    # Renaming onto the other class's name → 409.
    r = await client.patch(
        f"/admin/classes/{cid}", json={"shortName": "信安24-2"}, headers=admin
    )
    assert r.status_code == 409


async def test_class_delete_guarded(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    cid = class_setup["demo_class"].id
    assert (await client.delete(f"/admin/classes/{cid}", headers=admin)).status_code == 409

    empty = (
        await client.post(
            "/admin/classes", json={"fullName": "空班级", "shortName": "空班"}, headers=admin
        )
    ).json()
    assert (
        await client.delete(f"/admin/classes/{empty['id']}", headers=admin)
    ).status_code == 204


async def test_set_user_class_and_clear(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    other_cid = class_setup["other_class"].id

    # Assign the classless user.
    r = await client.post(
        "/admin/users/20240003001/class", json={"classId": other_cid}, headers=admin
    )
    assert r.status_code == 200, r.text
    assert r.json()["classShortName"] == "信安24-2"

    # Bad class id → 400.
    r = await client.post(
        "/admin/users/20240003001/class", json={"classId": 99999}, headers=admin
    )
    assert r.status_code == 400

    # Clearing the 班委甲's class also drops the committee flag.
    r = await client.post(
        "/admin/users/20240001001/class", json={"classId": None}, headers=admin
    )
    body = r.json()
    assert body["classId"] is None
    assert body["isClassCommittee"] is False


async def test_set_committee(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")

    # Classless user can't be 班委.
    r = await client.post(
        "/admin/users/20240003001/committee",
        json={"isClassCommittee": True},
        headers=admin,
    )
    assert r.status_code == 400

    r = await client.post(
        "/admin/users/20240001002/committee",
        json={"isClassCommittee": True},
        headers=admin,
    )
    assert r.status_code == 200, r.text
    assert r.json()["isClassCommittee"] is True

    # The flag actually grants roll-call powers.
    member = await login("20240001002")
    assert (
        await client.post("/classes/me/rollcalls", json={}, headers=member)
    ).status_code == 201

    # …and can be revoked.
    r = await client.post(
        "/admin/users/20240001002/committee",
        json={"isClassCommittee": False},
        headers=admin,
    )
    assert r.json()["isClassCommittee"] is False


async def test_admin_user_rows_carry_class_fields(
    client: AsyncClient, class_setup, login
) -> None:
    admin = await login("20240009001")
    rows = (await client.get("/admin/users", headers=admin)).json()
    by_sid = {u["sid"]: u for u in rows}
    assert by_sid["20240001001"]["classShortName"] == "计算机24-3"
    assert by_sid["20240001001"]["isClassCommittee"] is True
    assert by_sid["20240003001"]["classShortName"] is None


async def test_create_user_with_class(client: AsyncClient, class_setup, login) -> None:
    admin = await login("20240009001")
    cid = class_setup["demo_class"].id
    r = await client.post(
        "/admin/users",
        json={"sid": "20240001777", "name": "新同学", "classId": cid},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    assert r.json()["classShortName"] == "计算机24-3"

    r = await client.post(
        "/admin/users",
        json={"sid": "20240001778", "name": "错班级", "classId": 99999},
        headers=admin,
    )
    assert r.status_code == 400
