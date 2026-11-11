"""Officer dashboard API (officers see their department; admins see everything)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.agents import actions, policy
from app.api.access import get_grievance_for, staff_scope
from app.api.serializers import grievance_detail, grievance_summary
from app.core.deps import require_officer
from app.core.errors import DomainError, Forbidden, InvalidTransition, NotFound
from app.core.time import as_aware, utcnow
from app.db.session import get_db
from app.models import Assignment, DuplicateGroupMember, Grievance, GrievanceCategory, Officer, OfficerNote, SlaRecord, User
from app.models.enums import OPEN_STATUSES, GrievanceStatus
from app.schemas.api import EscalateIn, NoteIn, ReassignIn, ReviewDecisionIn, StatusUpdateIn, UnlinkIn
from app.services import audit, notifications
from app.services.audit import actor_of
from app.services.grievances import transition
from app.services.webhooks import grievance_payload, queue_event

router = APIRouter(prefix="/officer", tags=["officer"])
OPEN = [s.value for s in OPEN_STATUSES]
URG_RANK = case({"critical": 0, "high": 1, "medium": 2, "low": 3}, value=Grievance.urgency, else_=4)


@router.get("/queue")
def queue(
    scope: str = Query(default="mine", pattern="^(mine|department|review|all)$"),
    status: str | None = None,
    urgency: str | None = None,
    category: str | None = None,
    sla_state: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    include_closed: bool = False,
    limit: int = Query(default=100, le=500),
    user: User = Depends(require_officer),
    db: Session = Depends(get_db),
):
    stmt = staff_scope(select(Grievance).where(Grievance.is_historical.is_(False)), user)
    off = user.officer
    if scope == "mine" and off is not None:
        stmt = stmt.where(Grievance.assigned_officer_id == off.id)
    elif scope == "review":
        stmt = stmt.where(Grievance.status == GrievanceStatus.PENDING_REVIEW.value)
    if status:
        stmt = stmt.where(Grievance.status == status)
    elif not include_closed and scope != "review":
        stmt = stmt.where(Grievance.status.in_(OPEN + [GrievanceStatus.RESOLVED.value]))
    if urgency:
        stmt = stmt.where(Grievance.urgency == urgency)
    if category:
        stmt = stmt.join(GrievanceCategory, GrievanceCategory.id == Grievance.category_id).where(GrievanceCategory.code == category)
    if sla_state:
        stmt = stmt.join(SlaRecord, SlaRecord.grievance_id == Grievance.id).where(SlaRecord.state == sla_state)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Grievance.public_id.ilike(like) | Grievance.title.ilike(like) | Grievance.location_text.ilike(like))
    stmt = stmt.order_by(Grievance.escalation_level.desc(), URG_RANK, Grievance.sla_due_at.asc().nulls_last()).limit(limit)
    return [grievance_summary(g, user) for g in db.scalars(stmt)]


@router.get("/stats")
def stats(user: User = Depends(require_officer), db: Session = Depends(get_db)):
    base = staff_scope(select(Grievance).where(Grievance.is_historical.is_(False)), user).subquery()
    rows = dict(db.execute(select(base.c.status, func.count()).group_by(base.c.status)).all())
    now = utcnow()
    open_rows = db.execute(select(base.c.id, base.c.sla_due_at, base.c.escalation_level, base.c.assigned_officer_id)
                           .where(base.c.status.in_(OPEN))).all()
    off = user.officer
    return {
        "by_status": rows,
        "open": sum(rows.get(s, 0) for s in OPEN),
        "pending_review": rows.get(GrievanceStatus.PENDING_REVIEW.value, 0),
        "overdue": sum(1 for r in open_rows if r.sla_due_at and as_aware(r.sla_due_at) < now),
        "escalated": sum(1 for r in open_rows if r.escalation_level > 0),
        "assigned_to_me": sum(1 for r in open_rows if off and r.assigned_officer_id == off.id),
        "awaiting_citizen": rows.get(GrievanceStatus.RESOLVED.value, 0),
    }


@router.get("/grievances/{public_id}")
def detail(public_id: str, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    return grievance_detail(db, get_grievance_for(db, user, public_id), user)


def _officer_by_code(db: Session, code: str, g: Grievance) -> Officer:
    o = db.scalar(select(Officer).where(Officer.code == code, Officer.is_active.is_(True)))
    if o is None:
        raise NotFound(f"Officer {code} not found.")
    if g.department_id and o.department_id != g.department_id:
        raise DomainError("Officer belongs to a different department.")
    if g.is_sensitive and not o.handles_sensitive:
        raise DomainError("Sensitive grievances can only be assigned to officers authorised for sensitive cases.")
    return o


@router.post("/grievances/{public_id}/review")
def review(public_id: str, body: ReviewDecisionIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    """Human review decision: confirm/correct the category and assign an officer."""
    g = get_grievance_for(db, user, public_id)
    if g.status != GrievanceStatus.PENDING_REVIEW.value:
        raise InvalidTransition("This grievance is not awaiting review.")
    if g.is_sensitive and user.officer is not None and not user.officer.handles_sensitive:
        raise Forbidden("Only officers authorised for sensitive cases may review this grievance.")
    actor, actor_type = actor_of(user)
    before = {"category": g.category.code if g.category else None, "department": g.department.code if g.department else None}

    if body.category_code and body.category_code != before["category"]:
        cat = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == body.category_code, GrievanceCategory.is_active.is_(True)))
        if cat is None:
            raise NotFound("Category not found.")
        decision = policy.evaluate(cat, confidence=1.0, submitted_at=as_aware(g.created_at), urgency=g.urgency)
        g.category_id, g.department_id = cat.id, cat.department_id
        g.is_sensitive, g.identity_hidden = decision.is_sensitive, decision.hide_identity
        g.sla_due_at, g.policy_explanation = decision.sla_due_at, {**decision.explanation(), "reclassified_by": actor}
        if g.sla_record:
            g.sla_record.due_at, g.sla_record.sla_hours = decision.sla_due_at, decision.sla_hours
        if user.officer is not None and g.department_id != user.officer.department_id and user.role != "admin":
            # Reclassified out of this officer's department: hand over to that department's review queue.
            db.add(Assignment(grievance_id=g.id, department_id=g.department_id, actor=actor, actor_type=actor_type,
                              reason=f"Reclassified to {cat.code}: {body.note}"))
            audit.record(db, action="review.reclassified", actor=actor, actor_type=actor_type, grievance=g,
                         explanation={"before": before, "after": cat.code, "note": body.note})
            notifications.notify_department_reviewers(db, g, "review_required", f"Review required: {g.public_id}",
                                                      f"Reclassified to your department by a reviewer: {body.note}",
                                                      sensitive_only=g.is_sensitive)
            db.commit()
            return grievance_detail(db, g, user)

    if body.officer_code:
        officer = _officer_by_code(db, body.officer_code, g)
    else:
        officer, why = actions.pick_officer(db, g, sensitive=g.is_sensitive)
        if officer is None:
            raise DomainError(f"No eligible officer available ({why.get('reason')}). Choose an officer explicitly.")
    g.assigned_officer_id = officer.id
    g.needs_human_review = False
    g.reviewed_by_id, g.reviewed_at = user.id, utcnow()
    db.add(Assignment(grievance_id=g.id, department_id=g.department_id, officer_id=officer.id, actor=actor,
                      actor_type=actor_type, reason=f"Human review: {body.note}"))
    transition(db, g, GrievanceStatus.ASSIGNED, actor=actor, actor_type=actor_type, note=f"Reviewed and assigned to {officer.code}. {body.note}")
    audit.record(db, action="review.decision", actor=actor, actor_type=actor_type, grievance=g,
                 explanation={"before": before, "after": {"category": g.category.code, "department": g.department.code if g.department else None,
                              "officer": officer.code}, "ai_confidence": g.ai_confidence, "note": body.note})
    notifications.notify_officer(db, g, "assigned", f"Grievance assigned: {g.public_id}", g.title, created_by=actor)
    notifications.notify_citizen(db, g, "assigned", f"{g.public_id} assigned",
                                 f"An officer of {g.department.name if g.department else 'the department'} is now handling your grievance.",
                                 created_by=actor)
    queue_event(db, "grievance.assigned", grievance_payload(g))
    _log_human_review(db, g, user, body.note, before)
    db.commit()
    return grievance_detail(db, g, user)


def _log_human_review(db: Session, g: Grievance, user: User, note: str, before: dict) -> None:
    """Record the human decision on the grievance's pipeline trace for observability."""
    from app.models import AgentRun, AgentTrace

    trace = db.scalar(select(AgentTrace).where(AgentTrace.grievance_id == g.id, AgentTrace.name == "grievance_pipeline")
                      .order_by(AgentTrace.id.desc()))
    if trace is None:
        return
    db.add(AgentRun(trace_id=trace.id, agent="human_review", status="ok", provider="human", model=user.role,
                    confidence=1.0, input_summary={"before": before},
                    output={"status": g.status, "category_code": g.category.code if g.category else None,
                            "officer": g.assigned_officer.code if g.assigned_officer else None, "note_chars": len(note)}))


@router.post("/grievances/{public_id}/status")
def update_status(public_id: str, body: StatusUpdateIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    g = get_grievance_for(db, user, public_id)
    actor, actor_type = actor_of(user)
    if body.status == "RESOLVED":
        if not (body.resolution_summary and len(body.resolution_summary.strip()) >= 10):
            raise DomainError("A resolution summary (at least 10 characters) is required to resolve a grievance.")
        g.resolution_summary = body.resolution_summary.strip()
    transition(db, g, body.status, actor=actor, actor_type=actor_type, note=body.note or (body.resolution_summary or ""))
    if body.status == "RESOLVED":
        notifications.notify_citizen(db, g, "resolved", f"{g.public_id} marked resolved",
                                     f"Action taken: {g.resolution_summary} Please confirm or dispute the resolution.", created_by=actor)
    elif body.status == "IN_PROGRESS":
        notifications.notify_citizen(db, g, "in_progress", f"Work started on {g.public_id}",
                                     "An officer has started working on your grievance.", created_by=actor)
    elif body.status == "CLOSED":
        notifications.notify_citizen(db, g, "closed", f"{g.public_id} closed", body.note or "Your grievance has been closed.", created_by=actor)
    db.commit()
    return grievance_detail(db, g, user)


@router.post("/grievances/{public_id}/notes", status_code=201)
def add_note(public_id: str, body: NoteIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    g = get_grievance_for(db, user, public_id)
    db.add(OfficerNote(grievance_id=g.id, author_id=user.id, body=body.body.strip()))
    actor, actor_type = actor_of(user)
    audit.record(db, action="note.added", actor=actor, actor_type=actor_type, grievance=g, explanation={"chars": len(body.body)})
    db.commit()
    return grievance_detail(db, g, user)


@router.post("/grievances/{public_id}/reassign")
def reassign(public_id: str, body: ReassignIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    g = get_grievance_for(db, user, public_id)
    if g.status not in (GrievanceStatus.ASSIGNED.value, GrievanceStatus.IN_PROGRESS.value, GrievanceStatus.REOPENED.value):
        raise InvalidTransition("Only active grievances can be reassigned.")
    officer = _officer_by_code(db, body.officer_code, g)
    actor, actor_type = actor_of(user)
    for a in db.scalars(select(Assignment).where(Assignment.grievance_id == g.id, Assignment.is_active.is_(True))):
        a.is_active = False
    prev = g.assigned_officer.code if g.assigned_officer else None
    g.assigned_officer_id = officer.id
    db.add(Assignment(grievance_id=g.id, department_id=g.department_id, officer_id=officer.id, actor=actor, actor_type=actor_type,
                      reason=body.note))
    audit.record(db, action="assignment.reassigned", actor=actor, actor_type=actor_type, grievance=g,
                 explanation={"from": prev, "to": officer.code, "note": body.note})
    notifications.notify_officer(db, g, "assigned", f"Grievance reassigned to you: {g.public_id}", body.note, created_by=actor)
    db.commit()
    return grievance_detail(db, g, user)


@router.post("/grievances/{public_id}/escalate")
def escalate(public_id: str, body: EscalateIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    g = get_grievance_for(db, user, public_id)
    if g.status not in OPEN:
        raise InvalidTransition("Only open grievances can be escalated.")
    actor, actor_type = actor_of(user)
    g.escalation_level += 1
    audit.record(db, action="escalation.manual", actor=actor, actor_type=actor_type, grievance=g,
                 explanation={"reason": body.reason, "level": g.escalation_level})
    notifications.notify_admins(db, g, "escalation", f"Escalated by officer: {g.public_id}", body.reason)
    queue_event(db, "grievance.escalated", {**grievance_payload(g), "reason": "manual"})
    db.commit()
    return grievance_detail(db, g, user)


@router.post("/grievances/{public_id}/duplicates/{other_id}/unlink")
def unlink(public_id: str, other_id: str, body: UnlinkIn, user: User = Depends(require_officer), db: Session = Depends(get_db)):
    """Remove an incorrect duplicate link. Both grievances are untouched apart from the link."""
    g = get_grievance_for(db, user, public_id)
    other = db.scalar(select(Grievance).where(Grievance.public_id == other_id))
    if other is None or other.duplicate_group_id != g.duplicate_group_id or g.duplicate_group_id is None:
        raise NotFound("These grievances are not linked.")
    m = db.scalar(select(DuplicateGroupMember).where(DuplicateGroupMember.group_id == g.duplicate_group_id,
                                                     DuplicateGroupMember.grievance_id == other.id))
    if m:
        m.is_active = False
    other.duplicate_group_id = None
    actor, actor_type = actor_of(user)
    audit.record(db, action="duplicate.unlinked", actor=actor, actor_type=actor_type, grievance=g,
                 explanation={"unlinked": other.public_id, "note": body.note})
    db.commit()
    return grievance_detail(db, g, user)
