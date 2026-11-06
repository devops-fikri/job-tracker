import asyncio

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..auth import COOKIE, digest, authenticate, create_session, current_user, end_session, hash_password, verify_password
from ..config import get_settings
from ..db import get_db
from ..models import User, UserSession
from ..schemas import LoginIn, MeOut, PasswordIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=MeOut)
async def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = await asyncio.to_thread(authenticate, db, body.email, body.password)
    if user is None:
        await asyncio.sleep(1)  # slow down guessing
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    token = create_session(db, user)
    s = get_settings()
    response.set_cookie(
        COOKIE, token, max_age=s.session_days * 86400, httponly=True, samesite="lax", secure=s.cookie_secure, path="/"
    )
    return user


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), jt_session: str | None = Cookie(default=None)):
    end_session(db, jt_session)
    response.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/password", status_code=204)
async def change_password(body: PasswordIn, db: Session = Depends(get_db), user: User = Depends(current_user),
                          jt_session: str | None = Cookie(default=None)):
    if not await asyncio.to_thread(verify_password, user.password_hash, body.current):
        await asyncio.sleep(1)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    user.password_hash = hash_password(body.new)
    # Changing the password signs out every other device.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.token_hash != digest(jt_session or "")))
    db.commit()


@router.post("/logout-others")
def logout_others(db: Session = Depends(get_db), user: User = Depends(current_user), jt_session: str | None = Cookie(default=None)):
    res = db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.token_hash != digest(jt_session or "")))
    db.commit()
    return {"signedOut": res.rowcount}
