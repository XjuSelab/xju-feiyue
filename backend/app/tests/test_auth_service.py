"""Unit tests for app.services.auth — bcrypt + JWT helpers (no HTTP)."""
from __future__ import annotations

from app.services.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_round_trip() -> None:
    h = hash_password("123456")
    assert h.startswith("$2") and len(h) >= 50  # bcrypt hash format
    assert verify_password("123456", h) is True
    assert verify_password("wrong", h) is False


def test_password_each_hash_is_different() -> None:
    """bcrypt salts should make repeated hashes diverge but both verify."""
    a = hash_password("abc")
    b = hash_password("abc")
    assert a != b
    assert verify_password("abc", a) and verify_password("abc", b)


def test_verify_password_handles_garbage_hash() -> None:
    # Catch ValueError from invalid bcrypt input — should return False, not raise.
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_jwt_round_trip() -> None:
    token = create_access_token("user-123", "20211010001")
    assert isinstance(token, str) and token.count(".") == 2
    assert decode_token(token) == "user-123"


def test_decode_invalid_token_returns_none() -> None:
    assert decode_token("not.a.token") is None
    assert decode_token("") is None
