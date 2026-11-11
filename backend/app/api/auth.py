from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.ratelimit import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.core.time import utcnow
from app.db.session import get_db
from app.models import User
from app.models.enums import ActorType, DataSource, Role
from app.schemas.api import LoginIn, PasswordChangeIn, ProfileUpdate, RegisterIn, TokenOut, UserOut
from app.services import audit
from app.services.audit import actor_of
from app.services.notifications import PREFERENCE_GROUPS

router = APIRouter(prefix="/auth", tags=["auth"])

# Constant-time-ish dummy hash so unknown e-mails take as long as wrong passwords.
_DUMMY_HASH = hash_password("dummy-password-1")

# Field-level permissions for self-service profile edits. E-mail and role are never self-editable.
# Staff names are official records managed by the system administrator.
EDITABLE_FIELDS: dict[str, set[str]] = {
    Role.CITIZEN.value: {"full_name", "phone", "preferred_language", "address", "ward", "notification_prefs"},
    Role.OFFICER.value: {"phone", "preferred_language", "notification_prefs"},
    Role.DEPT_ADMIN.value: {"phone", "preferred_language", "notification_prefs"},
    Role.ADMIN.value: {"full_name", "phone", "preferred_language", "notification_prefs"},
}

PERMISSIONS: dict[str, list[str]] = {
    Role.CITIZEN.value: ["File grievances", "View and track own grievances", "Confirm or dispute resolutions"],
    Role.OFFICER.value: ["View department grievances", "Update status of assigned cases", "Review AI recommendations",
                         "Reassign within department", "Escalate cases", "Department reports"],
    Role.DEPT_ADMIN.value: ["View all department grievances", "Approve pending reviews", "Assign and reassign cases",
                            "Manage department officers", "Department reports and SLA performance"],
    Role.ADMIN.value: ["Platform administration", "User and role management", "Category Master and policy rules",
                       "SLA configuration", "Audit logs", "AI and integration monitoring"],
}


def user_out(u: User) -> UserOut:
    off = u.officer
    dept = off.department if off and off.department else u.managed_department
    perms = list(PERMISSIONS.get(u.role, []))
    if off and off.handles_sensitive:
        perms.append("Handle sensitive grievances")
    prefs_allowed = [k for k, spec in PREFERENCE_GROUPS.items() if u.role in spec["roles"]]
    prefs = u.notification_prefs or {}
    return UserOut(
        id=u.id, email=u.email, full_name=u.full_name, phone=u.phone, role=u.role, preferred_language=u.preferred_language,
        officer_code=off.code if off else None,
        department_code=dept.code if dept else None,
        department_name=dept.name if dept else None,
        designation=off.designation if off else ("Department Administrator" if u.role == Role.DEPT_ADMIN.value else None),
        handles_sensitive=off.handles_sensitive if off else None,
        address=u.address, ward=u.ward,
        notification_prefs={k: bool(prefs.get(k, True)) for k in prefs_allowed},
        created_at=u.created_at, last_login_at=u.last_login_at, password_changed_at=u.password_changed_at,
        permissions=perms, editable_fields=sorted(EDITABLE_FIELDS.get(u.role, set())),
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
             role=Role.CITIZEN.value, preferred_language=body.preferred_language, data_source=DataSource.LIVE.value,
             last_login_at=utcnow())
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
    u.last_login_at = utcnow()
    db.commit()
    token, exp = create_access_token(u.id, u.role)
    return TokenOut(access_token=token, expires_in=exp, user=user_out(u))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    changes = body.model_dump(exclude_unset=True)
    allowed = EDITABLE_FIELDS.get(user.role, set())
    denied = sorted(k for k in changes if k not in allowed)
    if denied:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role cannot change: {', '.join(denied)}")
    if "full_name" in changes and not changes["full_name"]:
        raise HTTPException(422, "Full name cannot be empty")
    if "preferred_language" in changes and changes["preferred_language"] is None:
        raise HTTPException(422, "Choose a language")
    if "notification_prefs" in changes:
        groups = {k for k, spec in PREFERENCE_GROUPS.items() if user.role in spec["roles"]}
        prefs = changes["notification_prefs"] or {}
        unknown = sorted(set(prefs) - groups)
        if unknown:
            raise HTTPException(422, f"Unknown notification preferences for your role: {', '.join(unknown)}")
        changes["notification_prefs"] = {**(user.notification_prefs or {}), **{k: bool(v) for k, v in prefs.items()}}
    for k, v in changes.items():
        if k in ("phone", "address", "ward") and v == "":
            v = None
        setattr(user, k, v)
    actor, actor_type = actor_of(user)
    audit.record(db, action="profile.updated", actor=actor, actor_type=actor_type, explanation={"fields": sorted(changes)})
    db.commit()
    return user_out(user)


@router.post("/change-password", status_code=204)
def change_password(body: PasswordChangeIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    limiter.check(request, "change-password", limit=10, window=900)
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(422, "The new password must be different from the current one")
    user.password_hash = hash_password(body.new_password)
    user.password_changed_at = utcnow()
    actor, actor_type = actor_of(user)
    audit.record(db, action="auth.password_changed", actor=actor, actor_type=actor_type)
    db.commit()
