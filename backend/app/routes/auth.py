"""Auth + profile-settings routes."""
from __future__ import annotations

import secrets
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.deps import get_current_user, get_db
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


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)) -> LoginOut:
    stmt = select(User).where(User.sid == body.sid)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="学号或密码不正确")
    token = create_access_token(user.sid)
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
    fname = f"{user.sid}-{int(time.time())}-{secrets.token_hex(4)}{ext}"
    out_path = AVATAR_DIR / fname
    out_path.write_bytes(data)

    # Frontend joins this onto `VITE_API_BASE`; mounted at /uploads in main.py.
    user.avatar = f"{settings.public_base_url}/uploads/avatars/{fname}"
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
