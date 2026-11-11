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
        export_to_langfuse(self.trace)  # no-op unless Langfuse keys are configured
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
    "reasoning", "estimate_label", "ready", "missing", "method",
}

_project_cache: dict[str, str] = {}


def _lf_auth() -> dict[str, str]:
    s = get_settings()
    token = base64.b64encode(f"{s.langfuse_public_key}:{s.langfuse_secret_key}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def langfuse_project_id() -> str | None:
    """Resolve the Langfuse project id for the configured keys (needed to build a real trace URL)."""
    s = get_settings()
    if not s.langfuse_enabled:
        return None
    if s.langfuse_public_key in _project_cache:
        return _project_cache[s.langfuse_public_key]
    try:
        r = httpx.get(f"{s.langfuse_host.rstrip('/')}/api/public/projects", headers=_lf_auth(), timeout=5.0)
        if r.status_code == 200:
            data = r.json().get("data") or []
            if data and data[0].get("id"):
                _project_cache[s.langfuse_public_key] = data[0]["id"]
                return data[0]["id"]
        log.warning("Langfuse project lookup returned %s", r.status_code)
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Langfuse project lookup failed: %s", type(exc).__name__)
    return None


def langfuse_check() -> dict[str, Any]:
    s = get_settings()
    if not s.langfuse_enabled:
        return {"enabled": False, "ok": False, "detail": "LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set in backend/.env"}
    pid = langfuse_project_id()
    return {"enabled": True, "ok": pid is not None, "host": s.langfuse_host, "project_id": pid,
            "detail": "Credentials verified" if pid else "Could not authenticate with Langfuse (check keys and host)"}


def _iso(dt) -> str | None:
    from app.core.time import as_aware

    dt = as_aware(dt)
    return dt.isoformat() if dt else None


def export_to_langfuse(trace: AgentTrace) -> str | None:
    """Push a redacted, public trace to Langfuse: one trace, one span per agent step (LLM steps as
    generations) with inputs, structured outputs, reasoning trail, model, confidence and timing.

    Returns the real Langfuse trace URL, or None when Langfuse is not configured or the push failed."""
    from datetime import timedelta

    s = get_settings()
    if not s.langfuse_enabled:
        return None
    pv = public_view(trace)
    now = utcnow().isoformat()
    first_input = redact(trace.runs[0].input_summary) if trace.runs else {}
    last_output = pv["steps"][-1]["decision"] if pv["steps"] else {}
    events: list[dict[str, Any]] = [{
        "id": uuid.uuid4().hex, "timestamp": now, "type": "trace-create",
        "body": {"id": trace.trace_id, "name": trace.name, "public": True, "timestamp": _iso(trace.started_at),
                 "input": first_input, "output": last_output, "tags": ["GRIEVANCE", trace.name],
                 "metadata": {"app": "GRIEVANCE", "status": trace.status, "duration_ms": trace.duration_ms,
                              "privacy": "PII-redacted; structured decisions only, no raw model chain-of-thought"}},
    }]
    for run, st in zip(trace.runs, pv["steps"]):
        start = run.started_at
        end = start + timedelta(milliseconds=run.duration_ms or 0) if start else None
        is_llm = (run.provider or "") in {"groq", "gemini"}
        body = {
            "id": uuid.uuid4().hex, "traceId": trace.trace_id, "name": st["agent"],
            "startTime": _iso(start), "endTime": _iso(end),
            "input": redact(run.input_summary or {}), "output": st["decision"],
            "metadata": {"provider": st["provider"], "model": st["model"], "confidence": st["confidence"],
                         "duration_ms": st["duration_ms"], "references": st["references"]},
            "level": "ERROR" if st["error"] else "DEFAULT",
            "statusMessage": (run.error or "")[:300] or None,
        }
        if is_llm:
            body["model"] = run.model
        events.append({"id": uuid.uuid4().hex, "timestamp": now, "type": "generation-create" if is_llm else "span-create", "body": body})
    try:
        r = httpx.post(f"{s.langfuse_host.rstrip('/')}/api/public/ingestion", json={"batch": events},
                       headers=_lf_auth(), timeout=8.0)
        errors = []
        try:
            errors = r.json().get("errors") or []
        except ValueError:
            pass
        if r.status_code < 300 and not errors:
            pid = langfuse_project_id()
            if pid:
                trace.langfuse_url = f"{s.langfuse_host.rstrip('/')}/project/{pid}/traces/{trace.trace_id}"
                return trace.langfuse_url
            return None
        log.warning("Langfuse ingestion returned %s with %d errors", r.status_code, len(errors))
    except httpx.HTTPError as exc:
        log.warning("Langfuse export failed: %s", type(exc).__name__)
    return None
