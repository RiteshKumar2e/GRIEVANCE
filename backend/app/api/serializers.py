"""Role-aware serialisation. Identity masking is applied here so no endpoint can forget it."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.privacy import PROTECTED_NAME, mask_name, mask_phone
from app.core.time import as_aware, utcnow
from app.models import (
    AuditEvent,
    DuplicateGroupMember,
    Grievance,
    Officer,
    OfficerNote,
    RetrievedPrecedent,
    StatusHistory,
    User,
)
from app.models.enums import STAFF_ROLES, Role


def _iso(dt):
    dt = as_aware(dt)
    return dt.isoformat() if dt else None


def _actor_label(db: Session, actor: str, actor_type: str, viewer: User) -> str:
    if actor == "AI_SYSTEM":
        return "AI System"
    if actor.startswith("user:"):
        u = db.get(User, int(actor.split(":")[1]))
        if u is None:
            return actor_type.title()
        if u.role == Role.CITIZEN.value:
            return "You" if u.id == viewer.id else "Citizen"
        return f"{u.full_name} ({u.role})"
    return actor_type.title()


def sla_view(g: Grievance) -> dict[str, Any] | None:
    rec = g.sla_record
    if rec is None and g.sla_due_at is None:
        return None
    due = as_aware(rec.due_at if rec else g.sla_due_at)
    remaining = (due - utcnow()).total_seconds() / 3600 if due else None
    return {
        "due_at": _iso(due), "sla_hours": rec.sla_hours if rec else None,
        "state": rec.state if rec else None, "hours_remaining": round(remaining, 1) if remaining is not None else None,
        "predicted_resolution_hours": rec.predicted_resolution_hours if rec else None,
        "breach_probability": rec.breach_probability if rec else None,
        "estimate_label": (rec.prediction_basis or {}).get("estimate_label") if rec else None,
        "basis": {k: v for k, v in (rec.prediction_basis or {}).items() if k in {"basis", "sample_size", "department_load"}} if rec else None,
    }


def grievance_summary(g: Grievance, viewer: User) -> dict[str, Any]:
    return {
        "id": g.id, "public_id": g.public_id, "title": g.title, "status": g.status, "urgency": g.urgency,
        "language": g.language, "ward": g.ward, "location_text": g.location_text,
        "category": {"code": g.category.code, "name_en": g.category.name_en, "name_hi": g.category.name_hi,
                     "name_mr": g.category.name_mr} if g.category else None,
        "department": {"code": g.department.code, "name": g.department.name} if g.department else None,
        "assigned_officer": {"code": g.assigned_officer.code, "name": g.assigned_officer.name} if g.assigned_officer else None,
        "ai_confidence": g.ai_confidence, "needs_human_review": g.needs_human_review, "is_sensitive": g.is_sensitive,
        "identity_hidden": g.identity_hidden, "escalation_level": g.escalation_level, "reopen_count": g.reopen_count,
        "duplicate_group": g.duplicate_group.public_id if g.duplicate_group else None,
        "data_source": g.data_source, "is_historical": g.is_historical,
        "created_at": _iso(g.created_at), "updated_at": _iso(g.updated_at), "resolved_at": _iso(g.resolved_at),
        "sla": sla_view(g),
        # Staff lists show the same masked identity as the case view (hidden entirely for sensitive cases).
        **({"citizen": citizen_identity(g, viewer)} if viewer.role in STAFF_ROLES else {}),
    }


def citizen_identity(g: Grievance, viewer: User) -> dict[str, Any] | None:
    c = g.citizen
    if c is None:
        return None
    if viewer.role == Role.CITIZEN.value:
        return {"name": c.full_name, "phone": c.phone, "email": c.email} if c.id == viewer.id else None
    if g.identity_hidden:
        return {"name": PROTECTED_NAME, "phone": None, "email": None, "protected": True}
    return {"name": c.full_name if viewer.role == Role.ADMIN.value else mask_name(c.full_name),
            "phone": mask_phone(c.phone), "email": None, "protected": False}


def grievance_detail(db: Session, g: Grievance, viewer: User) -> dict[str, Any]:
    data = grievance_summary(g, viewer)
    is_staff = viewer.role in STAFF_ROLES
    data.update({
        "description": g.description, "input_mode": g.input_mode, "latitude": g.latitude, "longitude": g.longitude,
        "resolution_summary": g.resolution_summary, "citizen_feedback": g.citizen_feedback, "citizen_rating": g.citizen_rating,
        "closed_at": _iso(g.closed_at), "citizen": citizen_identity(g, viewer),
        "status_history": [
            {"from_status": h.from_status, "to_status": h.to_status, "actor_type": h.actor_type,
             "actor_label": _actor_label(db, h.actor, h.actor_type, viewer),
             "note": h.note if is_staff or h.actor_type != "OFFICER" or h.to_status in ("RESOLVED", "CLOSED") else "",
             "created_at": _iso(h.created_at)}
            for h in db.scalars(select(StatusHistory).where(StatusHistory.grievance_id == g.id).order_by(StatusHistory.created_at, StatusHistory.id))
        ],
    })
    if g.duplicate_group:
        data["duplicate_group_size"] = sum(1 for m in g.duplicate_group.members if m.is_active)
    if is_staff:
        data.update({
            "ai_summary": g.ai_summary, "ai_provider": g.ai_provider, "review_reasons": g.review_reasons,
            "policy_explanation": g.policy_explanation,
            "precedents": [
                {"rank": p.rank, "similarity": p.similarity, "summary": p.summary, "scope": p.filter_scope,
                 "public_id": p.precedent.public_id, "category": p.precedent.category.code if p.precedent.category else None,
                 "ward": p.precedent.ward, "data_source": p.precedent.data_source}
                for p in db.scalars(select(RetrievedPrecedent).where(RetrievedPrecedent.grievance_id == g.id).order_by(RetrievedPrecedent.rank))
            ],
            "duplicates": duplicate_view(db, g, viewer),
            "notes": [
                {"id": n.id, "body": n.body, "author": n.author.full_name if n.author else "n/a", "created_at": _iso(n.created_at)}
                for n in db.scalars(select(OfficerNote).where(OfficerNote.grievance_id == g.id).order_by(OfficerNote.created_at))
            ],
            "audit": [
                {"action": a.action, "actor": a.actor, "actor_type": a.actor_type, "provider": a.provider, "model": a.model,
                 "confidence": a.confidence, "explanation": a.explanation, "policy_refs": a.policy_refs,
                 "trace_id": a.trace_id, "created_at": _iso(a.created_at)}
                for a in db.scalars(select(AuditEvent).where(AuditEvent.grievance_id == g.id).order_by(AuditEvent.created_at, AuditEvent.id))
            ],
            "eligible_officers": [
                {"code": o.code, "name": o.name, "handles_sensitive": o.handles_sensitive}
                for o in db.scalars(select(Officer).where(Officer.department_id == g.department_id, Officer.is_active.is_(True)))
            ] if g.department_id else [],
        })
    return data


def duplicate_view(db: Session, g: Grievance, viewer: User) -> list[dict[str, Any]]:
    if not g.duplicate_group_id:
        return []
    from app.agents.duplicate import score_pair

    out = []
    for m in db.scalars(select(DuplicateGroupMember).where(DuplicateGroupMember.group_id == g.duplicate_group_id,
                                                           DuplicateGroupMember.is_active.is_(True))):
        other = m.grievance
        if other.id == g.id:
            continue
        pair = score_pair(g, other)  # similarity between *this* grievance and the linked one
        out.append({"public_id": other.public_id, "status": other.status, "ward": other.ward, "title": other.title,
                    "created_at": _iso(other.created_at), "score": pair.score, "signals": pair.signals,
                    "linked_by": m.linked_by})
    return out
