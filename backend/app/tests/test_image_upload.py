"""Note-image upload route — /notes/images.

Avatar upload (auth.py:121-156) is untested in this repo; this is the
first upload test, so it doubles as the reference pattern.
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest
from httpx import AsyncClient
from PIL import Image

from app.routes import uploads as uploads_route


def _png_bytes(size: tuple[int, int] = (8, 8)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=(120, 200, 120)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _isolate_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect IMAGE_DIR to a per-test tmp_path so disk artifacts vanish
    on teardown and parallel tests don't collide."""
    image_dir = tmp_path / "notes"
    monkeypatch.setattr(uploads_route, "IMAGE_DIR", image_dir)
    return image_dir


@pytest.mark.asyncio
async def test_upload_image_happy_path(
    client: AsyncClient,
    auth_headers: dict[str, str],
    _isolate_uploads: Path,
) -> None:
    data = _png_bytes()
    r = await client.post(
        "/notes/images",
        files={"file": ("hello.png", data, "image/png")},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "url" in body
    assert body["url"].startswith("http")
    # URL ends in /uploads/notes/<sid>/<file>.png
    assert "/uploads/notes/20211010001/" in body["url"]
    assert body["url"].endswith(".png")
    # File actually written.
    fname = body["url"].rsplit("/", 1)[-1]
    assert (_isolate_uploads / "20211010001" / fname).exists()


@pytest.mark.asyncio
async def test_upload_image_requires_auth(client: AsyncClient) -> None:
    r = await client.post(
        "/notes/images",
        files={"file": ("hello.png", _png_bytes(), "image/png")},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_upload_image_rejects_unknown_mime(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    r = await client.post(
        "/notes/images",
        files={"file": ("hello.txt", b"not an image", "text/plain")},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert "png" in r.json()["detail"]


@pytest.mark.asyncio
async def test_upload_image_rejects_oversize(
    client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Cap below the size of a trivial PNG (~90 bytes) so we can fail the
    # size check without pushing 8 MB through the test loop.
    monkeypatch.setattr(uploads_route, "MAX_IMAGE_BYTES", 16)
    big = _png_bytes()
    assert len(big) > 16
    r = await client.post(
        "/notes/images",
        files={"file": ("big.png", big, "image/png")},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert "8 MB" in r.json()["detail"]


@pytest.mark.asyncio
async def test_upload_image_rejects_spoofed_mime(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Claims image/png but the payload isn't actually a PNG — PIL.verify()
    should catch it before we land bytes on disk."""
    r = await client.post(
        "/notes/images",
        files={"file": ("evil.png", b"hello world", "image/png")},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert "解析" in r.json()["detail"]
