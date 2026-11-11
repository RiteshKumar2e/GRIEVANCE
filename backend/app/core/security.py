"""Password hashing (bcrypt) and JWT access tokens."""
from __future__ import annotations

from datetime import timedelta

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.time import utcnow


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; reject rather than silently truncate.
    raw = password.encode("utf-8")
    if len(raw) > 72:
        raise ValueError("Password too long")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    s = get_settings()
    expires = timedelta(minutes=s.jwt_expire_minutes)
    now = utcnow()
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + expires, "iss": "grievance"}
    token = jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)
    return token, int(expires.total_seconds())


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], issuer="grievance")
