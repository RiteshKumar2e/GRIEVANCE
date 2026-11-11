"""Append-only audit log."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.privacy import redact
from app.models import AuditEvent, Grievance, User
from app.models.enums import AI_ACTOR, ActorType, Role


class AuditIncomplete(ValueError):
    pass


def actor_of(user: User | None) -> tuple[str, str]:
    if user is None:
        return "SYSTEM", ActorType.SYSTEM.value
    kind = {Role.CITIZEN.value: ActorType.CITIZEN, Role.OFFICER.value: ActorType.OFFICER, Role.ADMIN.value: ActorType.ADMIN}[user.role]
    return f"user:{user.id}", kind.value


def record(
    db: Session,
    *,
    action: str,
    actor: str,
    actor_type: str,
    grievance: Grievance | None = None,
    provider: str | None = None,
    model: str | None = None,
    confidence: float | None = None,
    explanation: dict[str, Any] | None = None,
    policy_refs: list[str] | None = None,
    trace_id: str | None = None,
) -> AuditEvent:
    if actor_type == ActorType.AI.value:
        # Every AI action must be fully attributable.
        if actor != AI_ACTOR:
            raise AuditIncomplete("AI actions must use actor AI_SYSTEM")
        if not (provider and model and explanation is not None and policy_refs is not None and confidence is not None):
            raise AuditIncomplete("AI audit events require provider, model, confidence, explanation and policy_refs")
    ev = AuditEvent(
        grievance_id=grievance.id if grievance is not None else None,
        grievance_public_id=grievance.public_id if grievance is not None else None,
        actor=actor,
        actor_type=actor_type,
        action=action,
        provider=provider,
        model=model,
        confidence=round(confidence, 4) if confidence is not None else None,
        explanation=redact(explanation or {}),
        policy_refs=list(policy_refs or []),
        trace_id=trace_id,
    )
    db.add(ev)
    return ev


def record_ai(
    db: Session,
    *,
    action: str,
    grievance: Grievance | None,
    provider: str,
    model: str,
    confidence: float,
    explanation: dict[str, Any],
    policy_refs: list[str],
    trace_id: str | None,
) -> AuditEvent:
    return record(
        db, action=action, actor=AI_ACTOR, actor_type=ActorType.AI.value, grievance=grievance,
        provider=provider, model=model, confidence=confidence, explanation=explanation,
        policy_refs=policy_refs, trace_id=trace_id,
    )
