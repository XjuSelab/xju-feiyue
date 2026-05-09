"""Auth route tests — login / logout / me + JWT round-trip + 401 paths."""
from __future__ import annotations

from httpx import AsyncClient

from app.db.models import User


async def test_login_success(client: AsyncClient, demo_user: User) -> None:
    r = await client.post(
        "/auth/login",
        json={"sid": "20211010001", "password": "123456"},
    )
    assert r.status_code == 200
    body = r.json()

    # camelCase wire format mirrors frontend zod LoginResponseSchema
    assert set(body.keys()) == {"user", "token"}
    assert isinstance(body["token"], str) and len(body["token"]) > 20

    user = body["user"]
    assert user["id"] == "usr_test_zilun"
    assert user["sid"] == "20211010001"
    assert user["name"] == "Zilun Wei"
    assert user["bio"] == "测试账号"
    assert user["avatar"] is None  # nullish — pydantic emits null


async def test_login_wrong_password(client: AsyncClient, demo_user: User) -> None:
    r = await client.post(
        "/auth/login",
        json={"sid": "20211010001", "password": "wrong"},
    )
    assert r.status_code == 401
    assert r.json() == {"detail": "学号或密码不正确"}


async def test_login_unknown_sid(client: AsyncClient, demo_user: User) -> None:
    r = await client.post(
        "/auth/login",
        json={"sid": "99999999999", "password": "123456"},
    )
    assert r.status_code == 401
    assert r.json() == {"detail": "学号或密码不正确"}


async def test_login_invalid_sid_format(client: AsyncClient) -> None:
    # 10 digits — pydantic regex ^\d{11}$ should reject before reaching DB
    r = await client.post(
        "/auth/login",
        json={"sid": "2021101000", "password": "123456"},
    )
    assert r.status_code == 422
    assert "detail" in r.json()


async def test_login_empty_password(client: AsyncClient) -> None:
    r = await client.post(
        "/auth/login",
        json={"sid": "20211010001", "password": ""},
    )
    assert r.status_code == 422


async def test_logout_no_op(client: AsyncClient) -> None:
    # Stateless JWT — logout is a no-op 204
    r = await client.post("/auth/logout")
    assert r.status_code == 204
    assert r.content == b""


async def test_me_no_authorization_header(client: AsyncClient) -> None:
    r = await client.get("/auth/me")
    assert r.status_code == 401
    assert r.json() == {"detail": "未登录"}


async def test_me_malformed_authorization(client: AsyncClient) -> None:
    r = await client.get("/auth/me", headers={"Authorization": "NotBearer xyz"})
    assert r.status_code == 401


async def test_me_bogus_token(client: AsyncClient) -> None:
    r = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer abc.def.ghi"},
    )
    assert r.status_code == 401
    # 既可能是 'Token 无效或已过期' 也可能是其他 jose 报文，校验 detail 存在即可
    assert "detail" in r.json()


async def test_me_with_valid_token(client: AsyncClient, demo_user: User) -> None:
    # Login first to mint a real token, then echo it back to /auth/me.
    login = await client.post(
        "/auth/login",
        json={"sid": "20211010001", "password": "123456"},
    )
    assert login.status_code == 200
    token = login.json()["token"]

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["id"] == "usr_test_zilun"
    assert body["sid"] == "20211010001"
    assert body["name"] == "Zilun Wei"


async def test_me_token_for_deleted_user(
    client: AsyncClient, demo_user: User, db_session
) -> None:
    """Token signed for a user that was later deleted → 401."""
    # Mint token first
    login = await client.post(
        "/auth/login",
        json={"sid": "20211010001", "password": "123456"},
    )
    token = login.json()["token"]

    # Delete the user
    await db_session.delete(await db_session.get(User, "usr_test_zilun"))
    await db_session.commit()

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401
    assert me.json() == {"detail": "用户不存在"}
