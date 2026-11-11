"""Orchestrator — wires the six agents into traced workflows.

    analyze_intake   : Agent 1 (+ policy preview)          -> IntakeDraft (nothing submitted yet)
    confirm_draft    : citizen confirmation -> Grievance  -> run_pipeline
    run_pipeline     : Agent 2 policy -> 3 RAG -> 4 duplicates -> 5 SLA prediction -> 6 actions
    sla_scan         : Agent 5 monitor -> Agent 6 escalation
    auto_close       : closes RESOLVED, non-sensitive, auto-close-allowed cases after the confirmation window
"""
from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents import actions, duplicate, policy, predictive, rag
from app.agents.intake import run_intake
from app.core.config import get_settings
from app.core.errors import DomainError, Forbidden, NotFound, PolicyViolation
from app.core.time import as_aware, utcnow
from app.llm import embeddings
from app.llm.client import FALLBACK_PROVIDER
from app.models import Grievance, GrievanceCategory, IntakeDraft, SlaRecord, User
from app.models.enums import AI_ACTOR, OPEN_STATUSES, ActorType, DataSource, GrievanceStatus, SlaState
from app.services import audit, geo, notifications
from app.services.grievances import new_public_id, record_initial_status, transition
from app.services.tracing import Tracer, export_to_langfuse
from app.services.webhooks import grievance_payload, queue_event

DRAFT_TTL_HOURS = 24


# --------------------------------------------------------------------------- intake
def analyze_intake(
    db: Session,
    citizen: User,
    text: str,
    *,
    language_hint: str | None = None,
    location_hint: str | None = None,
    input_mode: str = "text",
) -> IntakeDraft:
    tracer = Tracer(db, "intake_analysis", metadata={"input_mode": input_mode})
    with tracer.step("intake", {"chars": len(text), "language_hint": language_hint, "input_mode": input_mode}) as run:
        res = run_intake(db, text, language_hint=language_hint, location_hint=location_hint, gazetteer=geo.gazetteer())
        run.provider, run.model, run.confidence = res.provider, res.model, res.category_confidence
        run.output = {"category_code": res.category_code, "confidence": res.category_confidence, "urgency": res.urgency,
                      "language": res.language, "method": res.method, "provider_attempts": res.provider_attempts}

    category = _category(db, res.category_code)
    with tracer.step("policy_preview", {"category_code": category.code}) as run:
        decision = policy.evaluate(category, confidence=res.category_confidence, submitted_at=utcnow(),
                                   urgency=res.urgency, injection_suspected=res.injection_suspected,
                                   sensitive_signals=res.sensitive_signals, llm_used=res.provider != FALLBACK_PROVIDER)
        run.provider, run.model, run.confidence = "policy-gate", "deterministic-v1", decision.confidence
        run.output = {"requires_human_review": decision.requires_human_review, "review_reasons": decision.review_reasons,
                      "policy_refs": decision.policy_refs, "is_sensitive": decision.is_sensitive, "sla_hours": decision.sla_hours}
    tracer.finish()

    lat, lon = geo.centroid(res.ward)
    extraction = {
        **res.to_dict(),
        "category": _category_view(category),
        "department": {"code": category.department.code, "name": category.department.name} if category.department else None,
        "latitude": lat, "longitude": lon,
        "policy_preview": {
            "requires_human_review": decision.requires_human_review, "review_reasons": decision.review_reasons,
            "is_sensitive": decision.is_sensitive, "hide_identity": decision.hide_identity, "sla_hours": decision.sla_hours,
        },
    }
    draft = IntakeDraft(
        token=secrets.token_urlsafe(24), citizen_id=citizen.id, raw_text=text, input_mode=input_mode,
        extraction=extraction, trace_id=tracer.trace_id, expires_at=utcnow() + timedelta(hours=DRAFT_TTL_HOURS),
    )
    db.add(draft)
    db.commit()
    return draft


def confirm_draft(db: Session, citizen: User, token: str, edits: dict[str, Any]) -> Grievance:
    draft = db.scalar(select(IntakeDraft).where(IntakeDraft.token == token))
    if draft is None:
        raise NotFound("Draft not found.")
    if draft.citizen_id != citizen.id:
        raise Forbidden("This draft belongs to another user.")
    if draft.status != "pending":
        raise DomainError("This draft has already been submitted or discarded.")
    if as_aware(draft.expires_at) < utcnow():
        raise DomainError("This draft has expired. Please describe the issue again.")
    if edits.get("confirmed") is not True:
        raise PolicyViolation("Explicit citizen confirmation is required before submission.")

    ex = draft.extraction
    ai_code = ex["category_code"]
    code = edits.get("category_code") or ai_code
    category = _category(db, code)
    confidence = float(ex["category_confidence"])
    citizen_override = code != ai_code
    if citizen_override:
        alt = next((a for a in ex.get("alternatives", []) if a["category_code"] == code), None)
        confidence = min(confidence, float(alt["score"]) if alt else 0.4)

    ward = edits.get("ward") or ex.get("ward")
    lat = edits.get("latitude") if edits.get("latitude") is not None else ex.get("latitude")
    lon = edits.get("longitude") if edits.get("longitude") is not None else ex.get("longitude")
    if lat is None and ward:
        lat, lon = geo.centroid(ward)

    urg_order = ["low", "medium", "high", "critical"]
    urgency = ex["urgency"]
    if edits.get("urgency") in urg_order and urg_order.index(edits["urgency"]) > urg_order.index(urgency):
        urgency = edits["urgency"]  # citizens may raise urgency, not silently lower the AI's safety estimate

    now = utcnow()
    g = Grievance(
        public_id=new_public_id(db), citizen_id=citizen.id,
        title=(edits.get("title") or ex["title"])[:300],
        description=(edits.get("description") or draft.raw_text)[:8000],
        language=ex["language"], input_mode=draft.input_mode,
        location_text=edits.get("location_text") or ex.get("location_text"), ward=ward, latitude=lat, longitude=lon,
        category_id=category.id, department_id=category.department_id, urgency=urgency,
        status=GrievanceStatus.SUBMITTED.value, ai_summary=ex["summary"], ai_confidence=confidence,
        ai_provider=f"{ex['provider']}:{ex['model']}", data_source=DataSource.LIVE.value, created_at=now,
    )
    db.add(g)
    db.flush()
    record_initial_status(db, g, f"user:{citizen.id}", ActorType.CITIZEN.value, "Submitted after citizen confirmation.")
    audit.record(db, action="grievance.submitted", actor=f"user:{citizen.id}", actor_type=ActorType.CITIZEN.value, grievance=g,
                 explanation={"confirmed": True, "citizen_override_category": citizen_override, "draft_trace": draft.trace_id})
    draft.status, draft.grievance_id = "confirmed", g.id

    run_pipeline(db, g, intake={**ex, "category_confidence": confidence, "citizen_override": citizen_override})
    db.commit()
    return g


# --------------------------------------------------------------------------- main pipeline
def run_pipeline(db: Session, g: Grievance, *, intake: dict[str, Any]) -> dict[str, Any]:
    tracer = Tracer(db, "grievance_pipeline", grievance_id=g.id, metadata={"grievance": g.public_id})
    provider, model = intake.get("provider", FALLBACK_PROVIDER), intake.get("model", "rules-v1")
    result: dict[str, Any] = {"trace_id": tracer.trace_id}
    try:
        # Agent 1 record (intake already ran during analysis; log its decision on this trace)
        with tracer.step("intake", {"language": g.language, "input_mode": g.input_mode}) as run:
            run.provider, run.model, run.confidence = provider, model, g.ai_confidence
            run.output = {"category_code": g.category.code, "confidence": g.ai_confidence, "urgency": g.urgency,
                          "language": g.language, "provider_attempts": intake.get("provider_attempts", [])}
        audit.record_ai(db, action="intake.classification", grievance=g, provider=provider, model=model,
                        confidence=g.ai_confidence or 0.0, trace_id=tracer.trace_id,
                        explanation={"category": g.category.code, "urgency": g.urgency, "language": g.language,
                                     "method": intake.get("method"), "alternatives": intake.get("alternatives", []),
                                     "citizen_override": intake.get("citizen_override", False)},
                        policy_refs=["POL-LLM-01"] if provider != FALLBACK_PROVIDER else [])

        # Agent 2 — policy gate
        with tracer.step("policy", {"category_code": g.category.code}) as run:
            decision = policy.evaluate(g.category, confidence=g.ai_confidence or 0.0, submitted_at=as_aware(g.created_at),
                                       urgency=g.urgency, injection_suspected=bool(intake.get("injection_suspected")),
                                       sensitive_signals=intake.get("sensitive_signals") or [], llm_used=provider != FALLBACK_PROVIDER)
            if intake.get("citizen_override"):
                decision.requires_human_review = True
                decision.review_reasons.append("Citizen changed the AI-suggested category.")
                decision.allowed_ai_actions = [a for a in decision.allowed_ai_actions if a != "assign_officer"]
            g.is_sensitive, g.identity_hidden = decision.is_sensitive, decision.hide_identity
            g.needs_human_review, g.review_reasons = decision.requires_human_review, decision.review_reasons
            g.sla_due_at, g.policy_explanation = decision.sla_due_at, decision.explanation()
            run.provider, run.model, run.confidence = "policy-gate", "deterministic-v1", decision.confidence
            run.output = {"requires_human_review": decision.requires_human_review, "review_reasons": decision.review_reasons,
                          "policy_refs": decision.policy_refs, "is_sensitive": decision.is_sensitive,
                          "hide_identity": decision.hide_identity, "sla_hours": decision.sla_hours,
                          "department_code": decision.department_code}
        audit.record_ai(db, action="policy.decision", grievance=g, provider="policy-gate", model="deterministic-v1",
                        confidence=decision.confidence, explanation=decision.explanation(), policy_refs=decision.policy_refs,
                        trace_id=tracer.trace_id)

        # Agent 3 — RAG precedents
        with tracer.step("rag", {"category_code": g.category.code}) as run:
            g.embedding = embeddings.embed_text(f"{g.title}. {g.description}")
            g.embedding_model = embeddings.provider_name()
            precedents = rag.retrieve(db, g.embedding, category_id=g.category_id, department_id=g.department_id, exclude_id=g.id)
            rag.store(db, g, precedents, tracer.trace_id)
            run.provider, run.model = "local-embeddings", g.embedding_model
            run.confidence = precedents[0].similarity if precedents else 0.0
            run.references = [p.grievance.public_id for p in precedents]
            run.output = {"retrieved": len(precedents), "scope": precedents[0].scope if precedents else None,
                          "guidance": rag.guidance(precedents)}
        if precedents:
            audit.record_ai(db, action="rag.precedents", grievance=g, provider="local-embeddings", model=g.embedding_model,
                            confidence=precedents[0].similarity, trace_id=tracer.trace_id, policy_refs=["POL-RAG-01"],
                            explanation={"references": [p.grievance.public_id for p in precedents],
                                         "similarities": [p.similarity for p in precedents]})

        # Agent 4 — duplicates
        with tracer.step("duplicate", {}) as run:
            matches = duplicate.find_duplicates(db, g)
            group = duplicate.link(db, g, matches)
            run.provider, run.model = "duplicate-scorer", "weighted-v1"
            run.confidence = matches[0].score if matches else 0.0
            run.references = [m.grievance.public_id for m in matches]
            run.output = {"duplicates_found": len(matches), "group_id": group.public_id if group else None,
                          "signals": matches[0].signals if matches else None}
        if group:
            audit.record_ai(db, action="duplicate.linked", grievance=g, provider="duplicate-scorer", model="weighted-v1",
                            confidence=matches[0].score, trace_id=tracer.trace_id, policy_refs=["POL-DUP-01"],
                            explanation={"group": group.public_id, "matched": [m.grievance.public_id for m in matches],
                                         "signals": matches[0].signals, "note": "Linked, not merged."})
            notifications.notify_citizen(db, g, "duplicate_linked", f"{g.public_id} linked to similar reports",
                                         "Other citizens reported a similar issue nearby. Your grievance stays open and is tracked individually.")
            queue_event(db, "grievance.duplicate_linked", {**grievance_payload(g), "group": group.public_id})

        # Agent 5 — SLA prediction
        with tracer.step("predictive", {"sla_hours": decision.sla_hours}) as run:
            rec = predictive.create_sla_record(db, g, decision.sla_hours, decision.sla_due_at)
            run.provider, run.model = "sla-predictor", "historical-quantile-v1"
            run.confidence = 1.0 - abs(0.5 - (rec.breach_probability or 0)) if rec.breach_probability is not None else None
            run.output = {"predicted_resolution_hours": rec.predicted_resolution_hours, "breach_probability": rec.breach_probability,
                          "state": rec.state, "estimate_label": rec.prediction_basis.get("estimate_label")}

        # Agent 6 — actions
        with tracer.step("actions", {"requires_human_review": decision.requires_human_review}) as run:
            out = actions.assign(db, g, decision, provider=provider, model=model, trace_id=tracer.trace_id)
            run.provider, run.model, run.confidence = "action-executor", "policy-bound-v1", decision.confidence
            run.output = {"actions": out["actions"], "status": out["status"]}
        notifications.notify_citizen(
            db, g, "submitted", f"Grievance {g.public_id} registered",
            ("Your grievance has been registered and is being reviewed by an officer."
             if decision.requires_human_review else
             f"Your grievance has been registered and assigned to {g.department.name if g.department else 'the department'}.")
            + f" Expected resolution by {g.sla_due_at:%d %b %Y}.",
        )
        queue_event(db, "grievance.created", grievance_payload(g))
        result.update({"decision": decision, "actions": out})
        tracer.finish("ok")
    except Exception:
        tracer.finish("error")
        raise
    finally:
        export_to_langfuse(tracer.trace)
    return result


# --------------------------------------------------------------------------- SLA monitor
def sla_scan(db: Session) -> dict[str, Any]:
    now = utcnow()
    tracer = Tracer(db, "sla_scan")
    counts = {"scanned": 0, "at_risk": 0, "breached": 0, "escalated": 0}
    with tracer.step("predictive", {"scope": "open grievances"}) as run:
        rows = db.execute(select(Grievance, SlaRecord).join(SlaRecord, SlaRecord.grievance_id == Grievance.id).where(
            Grievance.status.in_([s.value for s in OPEN_STATUSES]), Grievance.is_historical.is_(False))).all()
        refs = []
        for g, rec in rows:
            counts["scanned"] += 1
            new_state = predictive.assess(g, rec, now)
            old_state = rec.state
            rec.last_checked_at = now
            if new_state == old_state:
                continue
            rec.state = new_state
            refs.append(g.public_id)
            if new_state == SlaState.AT_RISK.value:
                counts["at_risk"] += 1
                rec.warnings_sent += 1
                msg = (f"SLA due {as_aware(rec.due_at):%d %b %H:%M} UTC. Predicted resolution "
                       f"{rec.predicted_resolution_hours} h; breach probability {rec.breach_probability:.0%} (demo estimate).")
                notifications.notify_officer(db, g, "sla_warning", f"SLA at risk: {g.public_id}", msg)
                audit.record_ai(db, action="sla.warning", grievance=g, provider="sla-predictor", model="historical-quantile-v1",
                                confidence=rec.breach_probability or 0.0, explanation={"state": new_state, "due_at": as_aware(rec.due_at).isoformat()},
                                policy_refs=["POL-SLA-01"], trace_id=tracer.trace_id)
                queue_event(db, "grievance.sla_at_risk", grievance_payload(g))
                if (rec.breach_probability or 0) >= 0.75 and g.escalation_level == 0:
                    actions.escalate(db, g, reason="Early escalation: high predicted breach probability.", trace_id=tracer.trace_id,
                                     provider="sla-predictor", model="historical-quantile-v1", confidence=rec.breach_probability or 0.0)
                    counts["escalated"] += 1
            elif new_state == SlaState.BREACHED.value:
                counts["breached"] += 1
                rec.breached_at = now
                actions.escalate(db, g, reason=f"SLA breached (due {as_aware(rec.due_at):%d %b %H:%M} UTC).", trace_id=tracer.trace_id)
                counts["escalated"] += 1
        run.provider, run.model, run.confidence = "sla-monitor", "rules-v1", 1.0
        run.references = refs[:50]
        run.output = dict(counts)
    tracer.finish()
    db.commit()
    return {**counts, "trace_id": tracer.trace_id}


def auto_close(db: Session) -> dict[str, Any]:
    """Close RESOLVED grievances the citizen has not responded to — never sensitive ones."""
    s = get_settings()
    cutoff = utcnow() - timedelta(days=s.auto_close_after_days)
    tracer = Tracer(db, "auto_close")
    closed, skipped = [], []
    with tracer.step("actions", {"cutoff_days": s.auto_close_after_days}) as run:
        for g in db.scalars(select(Grievance).where(Grievance.status == GrievanceStatus.RESOLVED.value,
                                                     Grievance.is_historical.is_(False))):
            if not g.resolved_at or as_aware(g.resolved_at) > cutoff:
                continue
            try:
                transition(db, g, GrievanceStatus.CLOSED, actor=AI_ACTOR, actor_type=ActorType.AI.value,
                           note=f"Auto-closed: no citizen response within {s.auto_close_after_days} days of resolution.",
                           trace_id=tracer.trace_id,
                           ai_meta={"provider": "deterministic-rules", "model": "auto-close-v1", "confidence": 1.0,
                                    "policy_refs": ["POL-AUTOCLOSE-01", "POL-SENSITIVE-02"],
                                    "explanation": {"resolved_at": as_aware(g.resolved_at).isoformat()}})
                notifications.notify_citizen(db, g, "closed", f"{g.public_id} closed",
                                             "Closed after the confirmation window. You can still dispute it from the tracking page.")
                closed.append(g.public_id)
            except PolicyViolation:
                skipped.append(g.public_id)  # sensitive / no auto-close: stays for a human
        run.provider, run.model, run.confidence = "action-executor", "auto-close-v1", 1.0
        run.references = closed
        run.output = {"actions": ["auto_close"], "closed": len(closed), "skipped_policy": len(skipped)}
    tracer.finish()
    db.commit()
    return {"closed": closed, "skipped_by_policy": skipped, "trace_id": tracer.trace_id}


# --------------------------------------------------------------------------- helpers
def _category(db: Session, code: str) -> GrievanceCategory:
    c = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == code, GrievanceCategory.is_active.is_(True)))
    if c is None:
        c = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == "GENERAL"))
    if c is None:
        raise DomainError("Category Master is empty. Import categories first.")
    return c


def _category_view(c: GrievanceCategory) -> dict[str, Any]:
    return {"code": c.code, "name_en": c.name_en, "name_hi": c.name_hi, "name_mr": c.name_mr,
            "is_sensitive": c.is_sensitive, "hide_identity": c.hide_identity, "sla_hours": c.sla_hours}
