"""In-app notifications (SMS/e-mail channels are recorded as simulated deliveries)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Grievance, Notification, Officer, User
from app.models.enums import AI_ACTOR, STAFF_ROLES, Role


# Optional notification groups, per recipient role. Anything not listed here is always delivered:
# a resolution awaiting the citizen's confirmation, new assignments, review requests and reopened cases.
PREFERENCE_GROUPS: dict[str, dict] = {
    "status_updates": {"roles": {Role.CITIZEN.value}, "kinds": {"assigned", "in_progress", "closed", "duplicate_linked", "escalation"},
                       "label": "Progress updates on my grievances"},
    "sla_alerts": {"roles": STAFF_ROLES, "kinds": {"sla_warning"}, "label": "Deadline (SLA) warnings"},
    "escalations": {"roles": STAFF_ROLES, "kinds": {"escalation"}, "label": "Escalation alerts"},
}
MANDATORY_KINDS = {"resolved", "review_required", "reopened"}


def preference_group(role: str, kind: str) -> str | None:
    for key, spec in PREFERENCE_GROUPS.items():
        if role in spec["roles"] and kind in spec["kinds"]:
            return key
    return None


def wants(user: User | None, kind: str) -> bool:
    if user is None or not user.is_active:
        return False
    if kind in MANDATORY_KINDS:
        return True
    group = preference_group(user.role, kind)
    if group is None:
        return True
    return bool((user.notification_prefs or {}).get(group, True))


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
    if not wants(db.get(User, user_id), kind):
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
    """System admins, plus the administrators of the grievance's department."""
    count = 0
    q = select(User).where(User.role == Role.ADMIN.value, User.is_active.is_(True))
    if g is not None and g.department_id:
        q = select(User).where(User.is_active.is_(True), (User.role == Role.ADMIN.value)
                               | ((User.role == Role.DEPT_ADMIN.value) & (User.department_id == g.department_id)))
    for admin in db.scalars(q):
        if notify(db, user_id=admin.id, kind=kind, title=title, body=body, grievance=g) is not None:
            count += 1
    return count
