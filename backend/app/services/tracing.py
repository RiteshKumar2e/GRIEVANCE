"""Agent tracing. Internal traces are always written to the DB (observability dashboard);
when Langfuse keys are configured a redacted copy is forwarded to Langfuse.

Traces store structured decisions, never raw chain-of-thought, and inputs are PII-redacted."""
from __future__ import annotations

import base64
import logging
import secrets
import time
import uuid
from contextlib import contextmanager
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.privacy import redact
from app.core.time import utcnow
from app.models import AgentRun, AgentTrace

log = logging.getLogger("grievance.tracing")


class Tracer:
    def __init__(self, db: Session, name: str, grievance_id: int | None = None, metadata: dict | None = None):
        self.db = db
        self.trace = AgentTrace(
            trace_id=uuid.uuid4().hex, name=name, grievance_id=grievance_id,
            metadata_json=metadata or {}, started_at=utcnow(),
        )
        db.add(self.trace)
        db.flush()
        self._t0 = time.perf_counter()

    @property
    def trace_id(self) -> str:
        return self.trace.trace_id

    def attach_grievance(self, grievance_id: int) -> None:
        self.trace.grievance_id = grievance_id

    @contextmanager
    def step(self, agent: str, input_summary: dict[str, Any] | None = None):
        run = AgentRun(trace_id=self.trace.id, agent=agent, input_summary=redact(input_summary or {}), started_at=utcnow())
        t0 = time.perf_counter()
        try:
            yield run
            run.status = run.status or "ok"
        except Exception as exc:
            run.status = "error"
            run.error = f"{type(exc).__name__}: {str(exc)[:300]}"
            raise
        finally:
            run.duration_ms = int((time.perf_counter() - t0) * 1000)
            run.output = redact(run.output or {})
            self.db.add(run)
            self.db.flush()

    def finish(self, status: str = "ok") -> AgentTrace:
        self.trace.status = status
        self.trace.ended_at = utcnow()
        self.trace.duration_ms = int((time.perf_counter() - self._t0) * 1000)
        self.db.flush()
        return self.trace


def ensure_share_token(trace: AgentTrace) -> str:
    if not trace.share_token:
        trace.share_token = secrets.token_urlsafe(24)
    return trace.share_token


def public_view(trace: AgentTrace) -> dict[str, Any]:
    """Shareable representation: decisions and references only, no complaint text or identities."""
    steps = []
    for r in trace.runs:
        out = r.output or {}
        steps.append({
            "agent": r.agent, "status": r.status, "provider": r.provider, "model": r.model,
            "confidence": r.confidence, "duration_ms": r.duration_ms,
            "decision": {k: v for k, v in out.items() if k in PUBLIC_OUTPUT_KEYS},
            "references": r.references or [],
            "error": "error" if r.error else None,
        })
    return {
        "trace_id": trace.trace_id, "name": trace.name, "status": trace.status,
        "started_at": trace.started_at, "duration_ms": trace.duration_ms, "steps": steps,
    }


PUBLIC_OUTPUT_KEYS = {
    "category_code", "confidence", "urgency", "language", "department_code", "requires_human_review",
    "review_reasons", "policy_refs", "is_sensitive", "hide_identity", "sla_hours", "retrieved", "scope",
    "duplicates_found", "group_id", "predicted_resolution_hours", "breach_probability", "state",
    "actions", "status", "provider_attempts", "scanned", "at_risk", "breached", "escalated",
}


def export_to_langfuse(trace: AgentTrace) -> str | None:
    """Best-effort push of a redacted, public trace to Langfuse's ingestion API."""
    s = get_settings()
    if not s.langfuse_enabled:
        return None
    pv = public_view(trace)
    events: list[dict[str, Any]] = [{
        "id": uuid.uuid4().hex, "timestamp": utcnow().isoformat(), "type": "trace-create",
        "body": {"id": trace.trace_id, "name": trace.name, "public": True,
                 "metadata": {"app": "GRIEVANCE", "status": trace.status}, "output": {"steps": len(pv["steps"])}},
    }]
    for st in pv["steps"]:
        events.append({
            "id": uuid.uuid4().hex, "timestamp": utcnow().isoformat(), "type": "span-create",
            "body": {"id": uuid.uuid4().hex, "traceId": trace.trace_id, "name": st["agent"],
                     "metadata": {"provider": st["provider"], "model": st["model"], "confidence": st["confidence"],
                                  "duration_ms": st["duration_ms"], "references": st["references"]},
                     "output": st["decision"], "level": "ERROR" if st["error"] else "DEFAULT"},
        })
    auth = base64.b64encode(f"{s.langfuse_public_key}:{s.langfuse_secret_key}".encode()).decode()
    try:
        r = httpx.post(f"{s.langfuse_host.rstrip('/')}/api/public/ingestion", json={"batch": events},
                       headers={"Authorization": f"Basic {auth}"}, timeout=5.0)
        if r.status_code < 300:
            url = f"{s.langfuse_host.rstrip('/')}/trace/{trace.trace_id}"
            trace.langfuse_url = url
            return url
        log.warning("Langfuse ingestion returned %s", r.status_code)
    except httpx.HTTPError as exc:
        log.warning("Langfuse export failed: %s", type(exc).__name__)
    return None
