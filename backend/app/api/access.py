"""Object-level authorization for grievances."""
from __future__ import annotations

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.errors import Forbidden, NotFound
from app.models import Grievance, User
from app.models.enums import Role


def staff_scope(q: Select, user: User) -> Select:
    """Restrict a grievance query to what this officer may see (admins see everything)."""
    if user.role == Role.ADMIN.value:
        return q
    off = user.officer
    if off is None:
        return q.where(Grievance.id == -1)
    visible = or_(Grievance.assigned_officer_id == off.id, Grievance.department_id == off.department_id)
    q = q.where(visible)
    if not off.handles_sensitive:
        q = q.where(or_(Grievance.is_sensitive.is_(False), Grievance.assigned_officer_id == off.id))
    return q


def can_view(user: User, g: Grievance) -> bool:
    if user.role == Role.ADMIN.value:
        return True
    if user.role == Role.CITIZEN.value:
        return g.citizen_id == user.id
    off = user.officer
    if off is None:
        return False
    if g.assigned_officer_id == off.id:
        return True
    if g.department_id != off.department_id:
        return False
    return not g.is_sensitive or off.handles_sensitive


def get_grievance_for(db: Session, user: User, public_id: str) -> Grievance:
    g = db.scalar(select(Grievance).where(Grievance.public_id == public_id))
    if g is None:
        raise NotFound("Grievance not found.")
    if not can_view(user, g):
        # Do not reveal existence of other people's grievances.
        raise NotFound("Grievance not found.") if user.role == Role.CITIZEN.value else Forbidden("You do not have access to this grievance.")
    return g
