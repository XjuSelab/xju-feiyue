"""Auth + profile-settings routes."""
from __future__ import annotations

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
from PIL import UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Favorite, LoginEvent, Note, User
from app.deps import client_ip, get_current_user, get_db
from app.schemas.note import NoteOut
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
from app.services.notes import (
    count_comments,
    count_dislikes,
    count_favorites,
    count_likes,
    disliked_by_user,
    favorited_by_user,
    liked_by_user,
    to_note_out,
)
from app.services.uploads_common import make_thumbnail
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


@router.get("/me/favorites", response_model=list[NoteOut])
async def my_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteOut]:
    notes = list(
        (
            await db.execute(
                select(Note)
                .join(Favorite, Favorite.note_id == Note.id)
                .where(
                    Favorite.user_sid == user.sid,
                    Note.status == "visible",
                )
                .order_by(Favorite.created_at.desc())
                .options(selectinload(Note.author))
            )
        )
        .scalars()
        .all()
    )
    note_ids = [note.id for note in notes]
    likes = await count_likes(db, note_ids)
    dislikes = await count_dislikes(db, note_ids)
    favorites = await count_favorites(db, note_ids)
    comments = await count_comments(db, note_ids)
    liked_ids = await liked_by_user(db, user.sid, note_ids)
    disliked_ids = await disliked_by_user(db, user.sid, note_ids)
    favorited_ids = await favorited_by_user(db, user.sid, note_ids)
    return [
        to_note_out(
            note,
            likes.get(note.id, 0),
            comments.get(note.id, 0),
            note.id in liked_ids,
            dislikes=dislikes.get(note.id, 0),
            favorites=favorites.get(note.id, 0),
            disliked_by_me=note.id in disliked_ids,
            favorited_by_me=note.id in favorited_ids,
        )
        for note in notes
    ]


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
        make_thumbnail(data, thumb_path, AVATAR_THUMB_PX)
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