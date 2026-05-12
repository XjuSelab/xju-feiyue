"""Auth + profile-settings routes."""
from __future__ import annotations

import io
import secrets
import time
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LoginEvent, User
from app.deps import client_ip, get_current_user, get_db
from app.schemas.user import (
    LoginIn,
    LoginOut,
    PasswordChangeIn,
    UserMeUpdate,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])

# backend/uploads/avatars/ — git-ignored; volume-mounted in prod if needed.
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
AVATAR_DIR = UPLOAD_ROOT / "avatars"
ALLOWED_AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB
# Thumbnail long-edge in CSS pixels; 160 covers 2 × DPR on the 80 px chip,
# stays sharp on a retina screen, and weighs only ~5 KB as JPEG.
AVATAR_THUMB_PX = 160


def _make_thumbnail(data: bytes, out_path: Path) -> None:
    """Decode an uploaded avatar, downscale, and write JPEG to `out_path`."""
    img = Image.open(io.BytesIO(data))
    img.load()  # force decode now so bad files raise here, not later
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((AVATAR_THUMB_PX, AVATAR_THUMB_PX))
    img.save(out_path, "JPEG", quality=85, optimize=True)


@router.post("/login", response_model=LoginOut)
async def login(
    body: LoginIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginOut:
    stmt = select(User).where(User.sid == body.sid)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="学号或密码不正确")
    token = create_access_token(user.sid)
    ua = (request.headers.get("user-agent") or "")[:500] or None
    db.add(LoginEvent(user_sid=user.sid, ip=client_ip(request), user_agent=ua))
    await db.commit()
    return LoginOut(user=UserOut.model_validate(user), token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> Response:
    # Stateless JWT — server has nothing to revoke. Frontend clears localStorage.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserMeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    payload = body.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    ext = ALLOWED_AVATAR_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="仅支持 png / jpg / webp / gif")
    data = await file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="头像不能超过 2 MB")
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    # `<sid>-<ts>-<rand>.ext` — cache-busting + collision-safe.
    stem = f"{user.sid}-{int(time.time())}-{secrets.token_hex(4)}"
    fname = f"{stem}{ext}"
    thumb_name = f"{stem}.thumb.jpg"
    out_path = AVATAR_DIR / fname
    thumb_path = AVATAR_DIR / thumb_name
    out_path.write_bytes(data)
    try:
        _make_thumbnail(data, thumb_path)
    except UnidentifiedImageError as e:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="无法解析图片") from e

    # Frontend joins these onto `VITE_API_BASE`; mounted at /uploads in main.py.
    base = settings.public_base_url
    user.avatar = f"{base}/uploads/avatars/{fname}"
    user.avatar_thumb = f"{base}/uploads/avatars/{thumb_name}"
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
