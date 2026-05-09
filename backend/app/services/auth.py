"""Auth helpers — bcrypt password hashing + HS256 JWT issue/decode."""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.settings import settings

ALGO = "HS256"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, sid: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "sid": sid,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def decode_token(token: str) -> str | None:
    """Return user_id from a valid JWT, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except JWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
