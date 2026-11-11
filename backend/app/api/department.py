"""Department administration: the team and settings of one department.

Department administrators are always limited to users.department_id; a `department` query parameter
is honoured only for system administrators."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_dept_admin
from app.core.errors import DomainError, Forbidden, NotFound
from app.db.session import get_db
from app.models import Department, Grievance, GrievanceCategory, Officer, User
from app.models.enums import OPEN_STATUSES, Role
from app.schemas.api import TeamOfficerUpdate
from app.services import audit
from app.services.audit import actor_of

router = APIRouter(prefix="/department", tags=["department"])
OPEN = [s.value for s in OPEN_STATUSES]


def resolve_department(db: Session, user: User, code: str | None) -> Department:
    if user.role == Role.DEPT_ADMIN.value:
        if user.department_id is None:
            raise Forbidden("Your account is not linked to a department. Ask a system administrator.")
        dept = db.get(Department, user.department_id)
        if code and dept is not None and code != dept.code:
            raise Forbidden("You can only manage your own department.")
    else:
        if not code:
            raise DomainError("Choose a department.")
        dept = db.scalar(select(Department).where(Department.code == code))
    if dept is None:
        raise NotFound("Department not found.")
    return dept


def open_case_counts(db: Session, dept_id: int) -> dict[int, int]:
    return dict(db.execute(select(Grievance.assigned_officer_id, func.count()).where(
        Grievance.department_id == dept_id, Grievance.status.in_(OPEN), Grievance.is_historical.is_(False))
        .group_by(Grievance.assigned_officer_id)).all())


@router.get("/summary")
def summary(department: str | None = Query(default=None, max_length=40), user: User = Depends(require_dept_admin),
            db: Session = Depends(get_db)):
    d = resolve_department(db, user, department)
    unassigned = db.scalar(select(func.count()).select_from(Grievance).where(
        Grievance.department_id == d.id, Grievance.status.in_(OPEN), Grievance.assigned_officer_id.is_(None),
        Grievance.is_historical.is_(False)))
    return {
        "code": d.code, "name": d.name, "email": d.email, "phone": d.phone, "escalation_contact": d.escalation_contact,
        "is_active": d.is_active, "unassigned_open": unassigned,
        "categories": [{"code": c.code, "name_en": c.name_en, "sla_hours": c.sla_hours, "is_sensitive": c.is_sensitive,
                        "auto_close_allowed": c.auto_close_allowed}
                       for c in db.scalars(select(GrievanceCategory).where(GrievanceCategory.department_id == d.id,
                                                                           GrievanceCategory.is_active.is_(True))
                                           .order_by(GrievanceCategory.name_en))],
    }


@router.get("/officers")
def officers(department: str | None = Query(default=None, max_length=40), user: User = Depends(require_dept_admin),
             db: Session = Depends(get_db)):
    d = resolve_department(db, user, department)
    loads = open_case_counts(db, d.id)
    return [
        {"code": o.code, "name": o.name, "designation": o.designation, "email": o.user.email if o.user else None,
         "wards": o.wards, "max_active_cases": o.max_active_cases, "open_cases": loads.get(o.id, 0),
         "handles_sensitive": o.handles_sensitive, "is_active": o.is_active, "has_login": bool(o.user and o.user.is_active),
         "last_login_at": o.user.last_login_at.isoformat() if o.user and o.user.last_login_at else None}
        for o in db.scalars(select(Officer).where(Officer.department_id == d.id).order_by(Officer.code))
    ]


@router.patch("/officers/{code}")
def update_officer(code: str, body: TeamOfficerUpdate, user: User = Depends(require_dept_admin), db: Session = Depends(get_db)):
    o = db.scalar(select(Officer).where(Officer.code == code))
    if o is None:
        raise NotFound("Officer not found.")
    if user.role == Role.DEPT_ADMIN.value and o.department_id != user.department_id:
        raise Forbidden("This officer is not in your department.")
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise DomainError("Nothing to change.")
    open_now = open_case_counts(db, o.department_id).get(o.id, 0)
    if changes.get("is_active") is False and open_now:
        raise DomainError(f"{o.code} still has {open_now} open case(s). Reassign them before deactivating the officer.")
    if "max_active_cases" in changes and changes["max_active_cases"] < open_now:
        raise DomainError(f"Capacity cannot be below the {open_now} case(s) the officer currently holds.")
    before = {k: getattr(o, k) for k in changes}
    for k, v in changes.items():
        setattr(o, k, v)
    if "is_active" in changes and o.user:
        o.user.is_active = changes["is_active"]
    actor, actor_type = actor_of(user)
    audit.record(db, action="officer.updated", actor=actor, actor_type=actor_type,
                 explanation={"officer": code, "before": before, "after": changes})
    db.commit()
    return {"ok": True}
