"""Object-level authorization for grievances.

    admin       everything
    dept_admin  every grievance of the department in users.department_id (including sensitive ones,
                which they must approve and assign; identities stay hidden by the serializer)
    officer     grievances assigned to them, plus their department's non-sensitive grievances
                (sensitive ones only when the officer is authorised for sensitive cases)
    citizen     only their own grievances
"""
from __future__ import annotations

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.errors import Forbidden, NotFound
from app.models import Grievance, User
from app.models.enums import Role


def staff_department_id(user: User) -> int | None:
    """The department a staff member works in (None for system admins and citizens)."""
    if user.role == Role.DEPT_ADMIN.value:
        return user.department_id
    if user.role == Role.OFFICER.value and user.officer is not None:
        return user.officer.department_id
    return None


def staff_scope(q: Select, user: User) -> Select:
    """Restrict a grievance query to what this staff member may see."""
    if user.role == Role.ADMIN.value:
        return q
    if user.role == Role.DEPT_ADMIN.value:
        return q.where(Grievance.department_id == user.department_id) if user.department_id else q.where(Grievance.id == -1)
    off = user.officer
    if user.role != Role.OFFICER.value or off is None:
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
    if user.role == Role.DEPT_ADMIN.value:
        return user.department_id is not None and g.department_id == user.department_id
    off = user.officer
    if user.role != Role.OFFICER.value or off is None:
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
