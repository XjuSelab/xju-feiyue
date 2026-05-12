"""Note-image upload route — see BACKEND_SPEC.md §2 (Notes).

Lives under `/notes/images` (not `/uploads/images`) so it lands inside
nginx's existing `^/(auth|notes|drafts|...)` proxy_pass allowlist
without a config change. Files are written to
`backend/uploads/notes/<sid>/<file>` and exposed via the StaticFiles
mount at `/uploads` in main.py.
"""
from __future__ import annotations

import io
import secrets
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.db.models import User
from app.deps import get_current_user
from app.schemas.uploads import UploadedImage
from app.settings import settings

router = APIRouter(prefix="/notes", tags=["uploads"])

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
IMAGE_DIR = UPLOAD_ROOT / "notes"
ALLOWED_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


@router.post("/images", response_model=UploadedImage)
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> UploadedImage:
    ext = ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="仅支持 png / jpg / webp / gif")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="图片不能超过 8 MB")

    # PIL decode — defends against MIME-spoofed payloads (browser-trusted
    # Content-Type can lie; PIL actually parses the bytes).
    try:
        Image.open(io.BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as e:
        raise HTTPException(status_code=400, detail="无法解析图片") from e

    user_dir = IMAGE_DIR / user.sid
    user_dir.mkdir(parents=True, exist_ok=True)
    # `<ts>-<rand>.ext` — collision-safe across rapid uploads.
    fname = f"{int(time.time())}-{secrets.token_hex(4)}{ext}"
    (user_dir / fname).write_bytes(data)

    return UploadedImage(
        url=f"{settings.public_base_url}/uploads/notes/{user.sid}/{fname}"
    )
