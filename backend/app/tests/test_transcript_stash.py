"""成绩单中转 /notes/transcript-stash：POST 暂存 + 本人 GET 取回(取后即删)。"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

PDF = b"%PDF-1.4\nfake transcript bytes\n%%EOF"


@pytest.mark.asyncio
async def test_stash_then_owner_fetch(
    client: AsyncClient, demo_user, auth_headers: dict[str, str]
) -> None:
    # 书签回传（无鉴权，带学号）。
    r = await client.post(
        "/notes/transcript-stash",
        data={"sid": demo_user.sid},
        files={"file": ("查看成绩.pdf", PDF, "application/pdf")},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    # 本人取回 → 拿到 PDF 字节。
    r = await client.get("/notes/transcript-stash", headers=auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content == PDF

    # 取后即删 → 再取 204。
    r = await client.get("/notes/transcript-stash", headers=auth_headers)
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_get_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/notes/transcript-stash")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_rejects_non_pdf(client: AsyncClient) -> None:
    r = await client.post(
        "/notes/transcript-stash",
        data={"sid": "20211010001"},
        files={"file": ("x.pdf", b"not a pdf", "application/pdf")},
    )
    assert r.status_code == 400
