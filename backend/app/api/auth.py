from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.ratelimit import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.models.enums import ActorType, DataSource, Role
from app.schemas.api import LoginIn, ProfileUpdate, RegisterIn, TokenOut, UserOut
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])

# Constant-time-ish dummy hash so unknown e-mails take as long as wrong passwords.
_DUMMY_HASH = hash_password("dummy-password-1")


def user_out(u: User) -> UserOut:
    off = u.officer
    return UserOut(
        id=u.id, email=u.email, full_name=u.full_name, phone=u.phone, role=u.role, preferred_language=u.preferred_language,
        officer_code=off.code if off else None,
        department_code=off.department.code if off and off.department else None,
        department_name=off.department.name if off and off.department else None,
    )


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, "register", limit=10, window=3600)
    if body.website:  # honeypot tripped: reject without revealing why
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Registration could not be completed. Please try again later.")
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this e-mail already exists")
    u = User(email=email, full_name=body.full_name, phone=body.phone, password_hash=hash_password(body.password),
             role=Role.CITIZEN.value, preferred_language=body.preferred_language, data_source=DataSource.LIVE.value)
    db.add(u)
    db.flush()
    audit.record(db, action="auth.register", actor=f"user:{u.id}", actor_type=ActorType.CITIZEN.value)
    db.commit()
    token, exp = create_access_token(u.id, u.role)
    return TokenOut(access_token=token, expires_in=exp, user=user_out(u))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    limiter.check(request, "login", limit=20, window=300)
    u = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, u.password_hash if u else _DUMMY_HASH)
    if not u or not ok or not u.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect e-mail or password")
    token, exp = create_access_token(u.id, u.role)
    return TokenOut(access_token=token, expires_in=exp, user=user_out(u))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    return user_out(user)
