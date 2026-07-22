"""Admin dashboard + 3-tier role tests.

Covers: route gating (user→404, admin→ok, superadmin-only→admin 403),
single-user import (+409 dup), reset-password privilege hierarchy, promote /
demote, role-change guards, /auth/me role flags, the bootstrap super-admin
(admin_sid) being super even with a 'user' column, and the admin material-
management bypass (ensure_owner now honors both manager tiers).
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.services.auth import hash_password
from app.settings import settings

NORMAL_SID = "20211010001"  # conftest.demo_user, role 'user'
ADMIN_SID = "20240000002"


async def _add_user(
    db: AsyncSession, sid: str, *, role: str = "user", pw: str = "123456"
) -> models.User:
    u = models.User(
        sid=sid,
        name=f"U{sid[-3:]}",
        nickname=f"u{sid[-3:]}",
        password_hash=hash_password(pw),
        role=role,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _login(client: AsyncClient, sid: str, pw: str = "123456") -> dict[str, str]:
    r = await client.post("/auth/login", json={"sid": sid, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    await _add_user(db_session, ADMIN_SID, role="admin")
    return await _login(client, ADMIN_SID)


@pytest.fixture
async def super_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    # Bootstrap super-admin: created with the *default* 'user' column on
    # purpose — effective_role must still treat admin_sid as superadmin.
    await _add_user(db_session, settings.admin_sid)
    return await _login(client, settings.admin_sid)


# ---------------------------------------------------------------------------
# Gating
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unauthenticated_401(client: AsyncClient) -> None:
    assert (await client.get("/admin/users")).status_code == 401


@pytest.mark.asyncio
async def test_normal_user_gets_404(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    # Ordinary users must not even learn the /admin surface exists.
    for path in ("/admin/users", "/admin/stats", "/admin/login-events"):
        assert (await client.get(path, headers=auth_headers)).status_code == 404, path


@pytest.mark.asyncio
async def test_admin_can_read_users_and_stats(
    client: AsyncClient, auth_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    users = await client.get("/admin/users", headers=admin_headers)
    assert users.status_code == 200
    sids = {row["sid"] for row in users.json()}
    assert {NORMAL_SID, ADMIN_SID} <= sids

    stats = await client.get("/admin/stats", headers=admin_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["totalUsers"] >= 2
    assert len(body["loginActivity"]) == 14
    assert isinstance(body["totalStorageBytes"], int)
    # admin logged in via /auth/login → at least one login event today.
    assert body["loginsToday"] >= 1


# ---------------------------------------------------------------------------
# Import a single user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user_then_login_then_dup_409(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/admin/users",
        json={"sid": "20259999001", "name": "新同学"},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "user"
    # Default password works.
    assert (await client.post(
        "/auth/login", json={"sid": "20259999001", "password": "123456"}
    )).status_code == 200
    # Duplicate import → 409.
    dup = await client.post(
        "/admin/users",
        json={"sid": "20259999001", "name": "新同学"},
        headers=admin_headers,
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_create_user_custom_password(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/admin/users",
        json={"sid": "20259999002", "name": "李四", "password": "secret9"},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert (await client.post(
        "/auth/login", json={"sid": "20259999002", "password": "secret9"}
    )).status_code == 200


# ---------------------------------------------------------------------------
# Reset-password privilege hierarchy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_resets_normal_user(
    client: AsyncClient, auth_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    r = await client.post(
        f"/admin/users/{NORMAL_SID}/reset-password",
        json={"password": "brandnew"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["password"] == "brandnew"
    assert (await client.post(
        "/auth/login", json={"sid": NORMAL_SID, "password": "brandnew"}
    )).status_code == 200


@pytest.mark.asyncio
async def test_admin_cannot_reset_admin_or_super(
    client: AsyncClient,
    admin_headers: dict[str, str],
    super_headers: dict[str, str],  # ensures admin_sid row exists
    db_session: AsyncSession,
) -> None:
    other_admin = "20240000003"
    await _add_user(db_session, other_admin, role="admin")
    # plain admin → another admin → 403
    assert (await client.post(
        f"/admin/users/{other_admin}/reset-password", json={}, headers=admin_headers
    )).status_code == 403
    # plain admin → superadmin → 403
    assert (await client.post(
        f"/admin/users/{settings.admin_sid}/reset-password", json={}, headers=admin_headers
    )).status_code == 403


@pytest.mark.asyncio
async def test_super_resets_admin_but_not_super(
    client: AsyncClient, super_headers: dict[str, str], db_session: AsyncSession
) -> None:
    await _add_user(db_session, ADMIN_SID, role="admin")
    assert (await client.post(
        f"/admin/users/{ADMIN_SID}/reset-password", json={}, headers=super_headers
    )).status_code == 200
    # Even the super-admin can't reset the bootstrap super-admin via the API.
    assert (await client.post(
        f"/admin/users/{settings.admin_sid}/reset-password", json={}, headers=super_headers
    )).status_code == 403


@pytest.mark.asyncio
async def test_reset_missing_user_404(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    assert (await client.post(
        "/admin/users/19999999999/reset-password", json={}, headers=admin_headers
    )).status_code == 404


# ---------------------------------------------------------------------------
# Role changes (super-admin only)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_set_role_requires_superadmin(
    client: AsyncClient,
    auth_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    # normal user → 404 (surface hidden)
    assert (await client.post(
        f"/admin/users/{NORMAL_SID}/role", json={"role": "admin"}, headers=auth_headers
    )).status_code == 404
    # plain admin knows the surface but lacks the privilege → 403
    assert (await client.post(
        f"/admin/users/{NORMAL_SID}/role", json={"role": "admin"}, headers=admin_headers
    )).status_code == 403


@pytest.mark.asyncio
async def test_super_promote_then_demote(
    client: AsyncClient,
    auth_headers: dict[str, str],  # seeds NORMAL_SID
    super_headers: dict[str, str],
) -> None:
    # promote
    r = await client.post(
        f"/admin/users/{NORMAL_SID}/role", json={"role": "admin"}, headers=super_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "admin"
    promoted = await _login(client, NORMAL_SID)
    # now passes require_admin
    assert (await client.get("/admin/users", headers=promoted)).status_code == 200
    # demote
    assert (await client.post(
        f"/admin/users/{NORMAL_SID}/role", json={"role": "user"}, headers=super_headers
    )).status_code == 200
    demoted = await _login(client, NORMAL_SID)
    assert (await client.get("/admin/users", headers=demoted)).status_code == 404


@pytest.mark.asyncio
async def test_set_role_guards(
    client: AsyncClient, super_headers: dict[str, str]
) -> None:
    # can't change own (the bootstrap super) role
    assert (await client.post(
        f"/admin/users/{settings.admin_sid}/role",
        json={"role": "user"},
        headers=super_headers,
    )).status_code == 400
    # 'superadmin' is not an assignable role → schema 422
    assert (await client.post(
        f"/admin/users/{settings.admin_sid}/role",
        json={"role": "superadmin"},
        headers=super_headers,
    )).status_code == 422


# ---------------------------------------------------------------------------
# ICT&软开实验室成员标记 (super-admin only)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_lab_member_requires_superadmin(
    client: AsyncClient,
    auth_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    path = f"/admin/users/{NORMAL_SID}/lab-member"
    assert (
        await client.post(path, json={"isLabMember": True}, headers=auth_headers)
    ).status_code == 404
    assert (
        await client.post(path, json={"isLabMember": True}, headers=admin_headers)
    ).status_code == 403


@pytest.mark.asyncio
async def test_superadmin_sets_lab_member_and_me_exposes_flag(
    client: AsyncClient,
    auth_headers: dict[str, str],
    super_headers: dict[str, str],
) -> None:
    before = (await client.get("/auth/me", headers=auth_headers)).json()
    assert before["isLabMember"] is False

    path = f"/admin/users/{NORMAL_SID}/lab-member"
    marked = await client.post(path, json={"isLabMember": True}, headers=super_headers)
    assert marked.status_code == 200, marked.text
    assert marked.json()["isLabMember"] is True

    me = (await client.get("/auth/me", headers=auth_headers)).json()
    assert me["isLabMember"] is True

    rows = (await client.get("/admin/users", headers=super_headers)).json()
    row = next(item for item in rows if item["sid"] == NORMAL_SID)
    assert row["isLabMember"] is True

    unmarked = await client.post(path, json={"isLabMember": False}, headers=super_headers)
    assert unmarked.status_code == 200
    assert unmarked.json()["isLabMember"] is False


@pytest.mark.asyncio
async def test_set_lab_member_missing_user_404(
    client: AsyncClient, super_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/admin/users/19999999999/lab-member",
        json={"isLabMember": True},
        headers=super_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /auth/me role flags + bootstrap behaviour
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_me_role_flags(
    client: AsyncClient,
    auth_headers: dict[str, str],
    admin_headers: dict[str, str],
    super_headers: dict[str, str],
) -> None:
    normal = (await client.get("/auth/me", headers=auth_headers)).json()
    assert (normal["role"], normal["isAdmin"], normal["isSuperAdmin"]) == ("user", False, False)

    admin = (await client.get("/auth/me", headers=admin_headers)).json()
    assert (admin["role"], admin["isAdmin"], admin["isSuperAdmin"]) == ("admin", True, False)

    # admin_sid row was created with the default 'user' column → still super.
    sup = (await client.get("/auth/me", headers=super_headers)).json()
    assert sup["isAdmin"] is True and sup["isSuperAdmin"] is True


# ---------------------------------------------------------------------------
# Material-management bypass for the new admin tier
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_can_delete_others_material(
    client: AsyncClient,
    auth_headers: dict[str, str],  # NORMAL_SID owns the resource
    admin_headers: dict[str, str],  # plain admin (not admin_sid)
) -> None:
    created = await client.post(
        "/materials/resources",
        json={"title": "数据库原理", "description": "x", "tag": "专业课"},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    rid = created.json()["id"]
    # A plain admin (role='admin', not the configured admin_sid) can delete a
    # resource owned by someone else — both manager tiers co-manage 资料.
    deleted = await client.delete(f"/materials/resources/{rid}", headers=admin_headers)
    assert deleted.status_code == 204, deleted.text
