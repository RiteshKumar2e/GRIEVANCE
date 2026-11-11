"""Agent 6 — Agentic backend actions.

The only module that mutates grievance state on behalf of the AI. Every function checks the
policy decision first, then writes the change, an AI_SYSTEM audit event, notifications and
webhook events in the same DB transaction.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.policy import PolicyDecision, assert_ai_action_allowed
from app.models import Assignment, Grievance, Officer
from app.models.enums import AI_ACTOR, OPEN_STATUSES, ActorType, GrievanceStatus
from app.services import audit, notifications
from app.services.grievances import transition
from app.services.webhooks import grievance_payload, queue_event

OPEN = [s.value for s in OPEN_STATUSES]


def pick_officer(db: Session, g: Grievance, *, sensitive: bool = False) -> tuple[Officer | None, dict[str, Any]]:
    """Least-loaded active officer in the department whose ward coverage matches."""
    if not g.department_id:
        return None, {"reason": "no department"}
    officers = db.scalars(select(Officer).where(Officer.department_id == g.department_id, Officer.is_active.is_(True))).all()
    if sensitive:
        officers = [o for o in officers if o.handles_sensitive] or officers
    loads = dict(db.execute(
        select(Grievance.assigned_officer_id, func.count()).where(
            Grievance.assigned_officer_id.in_([o.id for o in officers]), Grievance.status.in_(OPEN)
        ).group_by(Grievance.assigned_officer_id)
    ).all())
    ranked = []
    for o in officers:
        covers = not o.wards or (g.ward in o.wards)
        load = loads.get(o.id, 0)
        if load >= o.max_active_cases:
            continue
        ranked.append(((0 if covers else 1), load / max(1, o.max_active_cases), o.id, o))
    if not ranked:
        return None, {"reason": "all officers at capacity", "candidates": len(officers)}
    ranked.sort(key=lambda r: r[:3])
    best = ranked[0]
    return best[3], {"ward_match": best[0] == 0, "utilisation": round(best[1], 3), "candidates": len(officers)}


def assign(
    db: Session,
    g: Grievance,
    decision: PolicyDecision,
    *,
    provider: str,
    model: str,
    trace_id: str,
) -> dict[str, Any]:
    actions: list[str] = []
    assert_ai_action_allowed(decision, "assign_department")
    g.department_id = decision.department_id
    meta_common = dict(provider=provider, model=model, confidence=decision.confidence, policy_refs=decision.policy_refs, trace_id=trace_id)

    if decision.requires_human_review:
        transition(db, g, GrievanceStatus.PENDING_REVIEW, actor=AI_ACTOR, actor_type=ActorType.AI.value,
                   note="Routed to human review by policy gate.", trace_id=trace_id,
                   ai_meta={**meta_common, "explanation": {"review_reasons": decision.review_reasons}})
        db.add(Assignment(grievance_id=g.id, department_id=g.department_id, officer_id=None, actor=AI_ACTOR,
                          actor_type=ActorType.AI.value, reason="Department routing pending human review"))
        n = notifications.notify_department_reviewers(
            db, g, "review_required", f"Review required: {g.public_id}",
            "A new grievance needs human review before assignment. " + " ".join(decision.review_reasons),
            sensitive_only=decision.is_sensitive,
        )
        if n == 0:
            notifications.notify_admins(db, g, "review_required", f"Review required: {g.public_id}",
                                        "No departmental reviewer is available; please review this grievance.")
        queue_event(db, "grievance.review_required", grievance_payload(g))
        actions += ["route_to_human_review", "notify_reviewers"]
        audit.record_ai(db, action="assignment.department", grievance=g, explanation={
            "department": decision.department_code, "officer": None, "why": "human review required"}, **meta_common)
        return {"actions": actions, "status": g.status, "officer": None}

    assert_ai_action_allowed(decision, "assign_officer")
    officer, why = pick_officer(db, g, sensitive=decision.is_sensitive)
    if officer is None:
        # Cannot assign: keep it visible to humans rather than guessing.
        g.needs_human_review = True
        g.review_reasons = [*g.review_reasons, f"No officer available ({why.get('reason')})."]
        transition(db, g, GrievanceStatus.PENDING_REVIEW, actor=AI_ACTOR, actor_type=ActorType.AI.value,
                   note="No officer available; routed to review.", trace_id=trace_id,
                   ai_meta={**meta_common, "explanation": why})
        notifications.notify_admins(db, g, "review_required", f"Unassigned: {g.public_id}", "No officer had capacity for this grievance.")
        return {"actions": ["route_to_human_review"], "status": g.status, "officer": None}

    g.assigned_officer_id = officer.id
    db.add(Assignment(grievance_id=g.id, department_id=g.department_id, officer_id=officer.id, actor=AI_ACTOR,
                      actor_type=ActorType.AI.value, reason=f"Least-loaded officer (ward match: {why['ward_match']})"))
    transition(db, g, GrievanceStatus.ASSIGNED, actor=AI_ACTOR, actor_type=ActorType.AI.value,
               note=f"Assigned to {officer.department.code if officer.department else ''} / {officer.code}.", trace_id=trace_id,
               ai_meta={**meta_common, "explanation": {"officer": officer.code, **why}})
    audit.record_ai(db, action="assignment.officer", grievance=g,
                    explanation={"department": decision.department_code, "officer": officer.code, **why}, **meta_common)
    notifications.notify_officer(db, g, "assigned", f"New grievance assigned: {g.public_id}",
                                 f"{g.title}. SLA due {g.sla_due_at:%d %b %Y %H:%M} UTC.")
    queue_event(db, "grievance.assigned", grievance_payload(g))
    actions += ["assign_department", "assign_officer", "notify_officer"]
    return {"actions": actions, "status": g.status, "officer": officer.code}


def escalate(db: Session, g: Grievance, *, reason: str, trace_id: str | None, provider: str = "deterministic-rules",
             model: str = "sla-monitor-v1", confidence: float = 1.0) -> None:
    g.escalation_level += 1
    refs = ["POL-SLA-01", "POL-NOREJECT-01"]
    audit.record_ai(db, action="escalation", grievance=g, provider=provider, model=model, confidence=confidence,
                    explanation={"reason": reason, "level": g.escalation_level}, policy_refs=refs, trace_id=trace_id)
    title = f"Escalated (level {g.escalation_level}): {g.public_id}"
    notifications.notify_officer(db, g, "escalation", title, reason)
    notifications.notify_department_reviewers(db, g, "escalation", title, reason, sensitive_only=g.is_sensitive)
    if g.escalation_level >= 2:
        notifications.notify_admins(db, g, "escalation", title, reason)
    notifications.notify_citizen(db, g, "escalation", f"Your grievance {g.public_id} has been escalated",
                                 "It has been escalated to senior officers to speed up resolution.")
    queue_event(db, "grievance.escalated", {**grievance_payload(g), "reason": reason})
