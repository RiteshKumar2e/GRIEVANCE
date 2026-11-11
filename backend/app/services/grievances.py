"""Grievance lifecycle: the single place where status changes happen.

Non-negotiable guards enforced here (independent of any LLM output):
  * AI_SYSTEM can never close a sensitive grievance (POL-SENSITIVE-02).
  * AI_SYSTEM can never close a category whose master forbids auto-close (POL-AUTOCLOSE-01).
  * AI_SYSTEM can never move a case out of human review (POL-REVIEW-01).
  * There is no 'rejected' status — nothing (human or AI) can reject a grievance outright.
"""
from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import InvalidTransition, PolicyViolation
from app.core.time import as_aware, utcnow
from app.models import Grievance, SlaRecord, StatusHistory
from app.models.enums import ActorType, GrievanceStatus as S, SlaState
from app.services import audit
from app.services.webhooks import grievance_payload, queue_event

TRANSITIONS: dict[str, set[str]] = {
    S.SUBMITTED: {S.PENDING_REVIEW, S.ASSIGNED},
    S.PENDING_REVIEW: {S.ASSIGNED},
    S.ASSIGNED: {S.IN_PROGRESS, S.RESOLVED, S.PENDING_REVIEW},
    S.IN_PROGRESS: {S.RESOLVED, S.PENDING_REVIEW},
    S.RESOLVED: {S.CLOSED, S.REOPENED},
    S.REOPENED: {S.ASSIGNED, S.IN_PROGRESS, S.RESOLVED},
    S.CLOSED: {S.REOPENED},
}

POLICY_TEXT = {
    "POL-SENSITIVE-01": "Sensitive categories always require human review.",
    "POL-SENSITIVE-02": "Sensitive grievances are never closed by AI_SYSTEM.",
    "POL-IDENTITY-01": "Identity-hiding categories mask the complainant's identity from officers.",
    "POL-CONF-01": "Classification below the category confidence threshold requires human review.",
    "POL-REVIEW-01": "Only a human reviewer can release a grievance from human review.",
    "POL-NOREJECT-01": "The AI never rejects a grievance; there is no automatic rejection.",
    "POL-LIABILITY-01": "The AI never determines legal liability; such findings are reserved for competent authorities.",
    "POL-AUTOCLOSE-01": "Auto-closure is allowed only for non-sensitive categories whose master permits it.",
    "POL-INJECT-01": "Complaint text containing instruction-like content is routed to human review.",
    "POL-SLA-01": "SLA is taken from the Category Master.",
    "POL-DUP-01": "Duplicate detection links grievances; it never merges or deletes them.",
    "POL-RAG-01": "Historical precedents are supporting evidence only.",
    "POL-LLM-01": "LLM output is advisory and validated by the deterministic policy gate.",
}


def new_public_id(db: Session, prefix: str = "GRV") -> str:
    year = utcnow().year
    for _ in range(10):
        candidate = f"{prefix}-{year}-{secrets.randbelow(900000) + 100000}"
        if not db.scalar(select(func.count()).select_from(Grievance).where(Grievance.public_id == candidate)):
            return candidate
    raise RuntimeError("could not allocate grievance id")


def transition(
    db: Session,
    g: Grievance,
    to: S | str,
    *,
    actor: str,
    actor_type: str,
    note: str = "",
    trace_id: str | None = None,
    ai_meta: dict | None = None,
) -> StatusHistory:
    to = S(to)
    current = S(g.status)
    if to not in TRANSITIONS.get(current, set()):
        raise InvalidTransition(f"Cannot move grievance from {current.value} to {to.value}.")

    is_ai = actor_type == ActorType.AI.value
    if is_ai and to == S.CLOSED:
        if g.is_sensitive:
            raise PolicyViolation("Sensitive grievances cannot be closed by AI_SYSTEM.", details={"policy": "POL-SENSITIVE-02"})
        if g.category is not None and not g.category.auto_close_allowed:
            raise PolicyViolation("This category does not permit automatic closure.", details={"policy": "POL-AUTOCLOSE-01"})
    if is_ai and current == S.PENDING_REVIEW:
        raise PolicyViolation("Only a human reviewer can release a grievance from review.", details={"policy": "POL-REVIEW-01"})

    now = utcnow()
    g.status = to.value
    if to == S.RESOLVED:
        g.resolved_at = now
        _close_sla(g, now)
    elif to == S.CLOSED:
        g.closed_at = now
    elif to == S.REOPENED:
        g.reopen_count += 1
        g.resolved_at = None
        g.closed_at = None
        if g.sla_record is not None:
            g.sla_record.state = SlaState.ON_TRACK.value if g.sla_due_at and as_aware(g.sla_due_at) > now else SlaState.BREACHED.value

    h = StatusHistory(grievance=g, from_status=current.value, to_status=to.value, actor=actor, actor_type=actor_type, note=note, created_at=now)
    db.add(h)

    if is_ai:
        meta = ai_meta or {}
        audit.record_ai(
            db, action=f"status.{to.value.lower()}", grievance=g,
            provider=meta.get("provider", "deterministic-rules"), model=meta.get("model", "rules-v1"),
            confidence=meta.get("confidence", 1.0),
            explanation=meta.get("explanation", {"from": current.value, "to": to.value, "note": note}),
            policy_refs=meta.get("policy_refs", []), trace_id=trace_id,
        )
    else:
        audit.record(db, action=f"status.{to.value.lower()}", actor=actor, actor_type=actor_type, grievance=g,
                     explanation={"from": current.value, "to": to.value, "note": note[:500]}, trace_id=trace_id)
    queue_event(db, "grievance.status_changed", {**grievance_payload(g), "from": current.value})
    return h


def _close_sla(g: Grievance, now: datetime) -> None:
    rec: SlaRecord | None = g.sla_record
    if rec is None:
        return
    from app.core.time import as_aware

    due = as_aware(rec.due_at)
    rec.state = SlaState.MET.value if due and now <= due else SlaState.MISSED.value
    rec.last_checked_at = now


def record_initial_status(db: Session, g: Grievance, actor: str, actor_type: str, note: str) -> None:
    db.add(StatusHistory(grievance=g, from_status=None, to_status=g.status, actor=actor, actor_type=actor_type, note=note))
