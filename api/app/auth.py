import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User, UserSession, utcnow
from .schemas import aware

COOKIE = "jt_session"
_ph = PasswordHasher()
# Verified against when the email is unknown, so timing doesn't reveal which accounts exist.
_DUMMY_HASH = _ph.hash(secrets.token_hex(16))


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        verify_password(_DUMMY_HASH, password)
        return None
    if not verify_password(user.password_hash, password):
        return None
    if _ph.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
    return user


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.execute(delete(UserSession).where(UserSession.expires_at < now))
    db.add(UserSession(token_hash=digest(token), user_id=user.id, expires_at=now + timedelta(days=get_settings().session_days)))
    db.commit()
    return token


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == digest(token)))
        db.commit()


def current_user(db: Session = Depends(get_db), jt_session: str | None = Cookie(default=None)) -> User:
    if jt_session:
        sess = db.get(UserSession, digest(jt_session))
        if sess and aware(sess.expires_at) > utcnow():
            user = db.get(User, sess.user_id)
            if user:
                return user
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
