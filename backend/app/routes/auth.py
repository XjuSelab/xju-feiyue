"""Auth routes — see BACKEND_SPEC.md §2 (Auth)."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.deps import get_current_user, get_db
from app.schemas.user import LoginIn, LoginOut, UserOut
from app.services.auth import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)) -> LoginOut:
    stmt = select(User).where(User.sid == body.sid)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="学号或密码不正确")
    token = create_access_token(user.id, user.sid)
    return LoginOut(user=UserOut.model_validate(user), token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> Response:
    # Stateless JWT — server has nothing to revoke. Frontend clears localStorage.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
