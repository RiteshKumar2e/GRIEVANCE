"""In-app notifications (SMS/e-mail channels are recorded as simulated deliveries)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Grievance, Notification, Officer, User
from app.models.enums import AI_ACTOR, Role


def notify(
    db: Session,
    *,
    user_id: int | None,
    kind: str,
    title: str,
    body: str,
    grievance: Grievance | None = None,
    created_by: str = AI_ACTOR,
    channel: str = "in_app",
) -> Notification | None:
    if user_id is None:
        return None
    n = Notification(
        user_id=user_id, grievance_id=grievance.id if grievance else None, kind=kind, title=title,
        body=body, channel=channel, created_by=created_by,
    )
    db.add(n)
    return n


def notify_citizen(db: Session, g: Grievance, kind: str, title: str, body: str, created_by: str = AI_ACTOR) -> None:
    notify(db, user_id=g.citizen_id, kind=kind, title=title, body=body, grievance=g, created_by=created_by)


def notify_officer(db: Session, g: Grievance, kind: str, title: str, body: str, created_by: str = AI_ACTOR) -> None:
    if g.assigned_officer_id:
        off = db.get(Officer, g.assigned_officer_id)
        if off and off.user_id:
            notify(db, user_id=off.user_id, kind=kind, title=title, body=body, grievance=g, created_by=created_by)


def notify_department_reviewers(db: Session, g: Grievance, kind: str, title: str, body: str, sensitive_only: bool = False) -> int:
    """Notify officers of the grievance's department (sensitive handlers only for sensitive cases)."""
    if not g.department_id:
        return 0
    q = select(Officer).where(Officer.department_id == g.department_id, Officer.is_active.is_(True), Officer.user_id.is_not(None))
    if sensitive_only:
        q = q.where(Officer.handles_sensitive.is_(True))
    count = 0
    for off in db.scalars(q):
        notify(db, user_id=off.user_id, kind=kind, title=title, body=body, grievance=g)
        count += 1
    return count


def notify_admins(db: Session, g: Grievance | None, kind: str, title: str, body: str) -> int:
    count = 0
    for admin in db.scalars(select(User).where(User.role == Role.ADMIN.value, User.is_active.is_(True))):
        notify(db, user_id=admin.id, kind=kind, title=title, body=body, grievance=g)
        count += 1
    return count
