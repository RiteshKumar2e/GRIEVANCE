"""Agent tracing. Internal traces are always written to the DB (observability dashboard);
when Langfuse keys are configured a redacted copy is forwarded to Langfuse.

Traces store structured decisions, never raw chain-of-thought, and inputs are PII-redacted."""
from __future__ import annotations

import base64
import json
import logging
import re
import secrets
import time
import uuid
from contextlib import contextmanager
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.privacy import redact, redact_text
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


# Agents whose reasoning is derived from the complaint text itself (keywords, place names, model rationale).
# Their structured decision fields are shared publicly; their free-text reasoning is not.
_TEXT_DERIVED_AGENTS = {"intake", "intake_dialogue"}
_LOCATION_LINE = re.compile(r"^\s*(Location|Provisional category .* location)", re.IGNORECASE)


def _public_reasoning(agent: str, lines: Any) -> list[str] | None:
    if agent in _TEXT_DERIVED_AGENTS or not isinstance(lines, list):
        return None
    return [redact_text(str(line)) for line in lines if line and not _LOCATION_LINE.match(str(line))]


def public_view(trace: AgentTrace) -> dict[str, Any]:
    """Shareable representation: structured decisions and references only. Complaint text, place names,
    identities and model rationale are excluded; every remaining string is PII-redacted again."""
    steps = []
    for r in trace.runs:
        out = r.output or {}
        decision = {k: v for k, v in out.items() if k in PUBLIC_OUTPUT_KEYS and k != "reasoning"}
        reasoning = _public_reasoning(r.agent, out.get("reasoning"))
        if reasoning:
            decision["reasoning"] = reasoning
        steps.append({
            "agent": r.agent, "status": r.status, "provider": r.provider, "model": r.model,
            "confidence": r.confidence, "duration_ms": r.duration_ms,
            "decision": redact(decision),
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


# ---------------------------------------------------------------- Langfuse export (OpenTelemetry / OTLP)
#
# Traces are recorded in our database first and exported when a workflow finishes, so they are sent as OTLP
# spans with their real start/end times to Langfuse's real-time endpoint (/api/public/otel/v1/traces).
# Attribute names follow https://langfuse.com/integrations/native/opentelemetry (observation-level and
# trace-level attribute tables).

RELEASE = "1.0.0"
LLM_PROVIDERS = {"groq", "gemini"}
# Workflows where the language model actually ran. Other traces only *record* that decision (for example the
# pipeline re-logs the intake result), so they must not be typed as generations or tokens would be counted twice.
LLM_TRACES = {"intake_analysis", "intake_conversation"}
ROOT_TYPE = {"intake_analysis": "agent", "intake_conversation": "agent", "grievance_pipeline": "agent",
             "sla_scan": "chain", "auto_close": "chain"}
STEP_TYPE = {
    "intake": "chain", "intake_dialogue": "chain",    # upgraded to "generation" when an LLM ran in this trace
    "policy": "guardrail", "policy_preview": "guardrail",  # deterministic policy gate
    "rag": "retriever",                                # vector search over past grievances
    "duplicate": "tool",                               # links related reports (changes state)
    "predictive": "chain",                             # SLA / breach prediction
    "actions": "tool",                                 # assignment, status, notifications, webhooks
    "human_review": "event",                           # an officer's decision
}


def _ns(dt) -> str:
    from app.core.time import as_aware

    dt = as_aware(dt) or utcnow()
    return str(int(dt.timestamp() * 1_000_000_000))


def _attr(key: str, value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, bool):
        v: dict[str, Any] = {"boolValue": value}
    elif isinstance(value, int):
        v = {"intValue": str(value)}
    elif isinstance(value, float):
        v = {"doubleValue": value}
    elif isinstance(value, (list, tuple)):
        v = {"arrayValue": {"values": [{"stringValue": str(x)} for x in value]}}
    elif isinstance(value, dict):
        v = {"stringValue": json.dumps(value, ensure_ascii=False, default=str)}
    else:
        v = {"stringValue": str(value)}
    return {"key": key, "value": v}


def _attrs(pairs: dict[str, Any]) -> list[dict[str, Any]]:
    return [a for k, val in pairs.items() if (a := _attr(k, val)) is not None]


def _usage(run: AgentRun) -> dict[str, int] | None:
    """Token usage reported by the provider for the successful LLM attempt of this step."""
    for att in (run.output or {}).get("provider_attempts") or []:
        if isinstance(att, dict) and att.get("status") == "ok" and isinstance(att.get("usage"), dict):
            u = {k: int(v) for k, v in att["usage"].items() if isinstance(v, (int, float))}
            return u or None
    return None


def _trace_context(trace: AgentTrace) -> dict[str, Any]:
    """Trace-level attributes, repeated on every span so Langfuse can filter observations by them."""
    s = get_settings()
    meta = trace.metadata_json or {}
    session = meta.get("grievance") or (trace.grievance.public_id if getattr(trace, "grievance", None) else None)
    env = re.sub(r"[^a-z0-9_-]", "-", (s.app_env or "development").lower()) or "development"
    return {
        "langfuse.trace.name": trace.name,
        "langfuse.session.id": session,          # all workflows of one grievance appear as one session
        "langfuse.user.id": meta.get("user_id"),  # internal account id only, never a name or contact detail
        "langfuse.environment": env,
        "langfuse.release": RELEASE,
        "langfuse.version": RELEASE,
        "langfuse.trace.tags": ["grievance", trace.name, trace.status or "ok"],
        "langfuse.trace.metadata.app": "GRIEVANCE",
        "langfuse.trace.metadata.intake_trace_id": meta.get("intake_trace_id"),
        "langfuse.trace.metadata.privacy": "PII-redacted; structured decision trail, no raw model chain-of-thought",
    }


def build_otlp_payload(trace: AgentTrace) -> dict[str, Any]:
    """OTLP/JSON ExportTraceServiceRequest for one recorded trace."""
    pv = public_view(trace)
    ctx = _trace_context(trace)
    root_id = secrets.token_hex(8)
    llm_trace = trace.name in LLM_TRACES
    first_input = redact(trace.runs[0].input_summary) if trace.runs else {}
    last_output = pv["steps"][-1]["decision"] if pv["steps"] else {}
    failed = any(st["error"] for st in pv["steps"]) or trace.status == "error"

    spans: list[dict[str, Any]] = [{
        "traceId": trace.trace_id, "spanId": root_id, "name": trace.name, "kind": 1,
        "startTimeUnixNano": _ns(trace.started_at), "endTimeUnixNano": _ns(trace.ended_at or utcnow()),
        "attributes": _attrs({
            **ctx,
            "langfuse.trace.public": True,
            "langfuse.observation.type": ROOT_TYPE.get(trace.name, "span"),
            # Identity and linking fields are already trace attributes; keep the root input to the workflow facts.
            "langfuse.observation.input": {**{k: v for k, v in (trace.metadata_json or {}).items() if k not in ("user_id", "intake_trace_id")}, **first_input},
            "langfuse.observation.output": last_output,
            "langfuse.observation.level": "ERROR" if failed else "DEFAULT",
            "langfuse.observation.metadata.duration_ms": trace.duration_ms,
            "langfuse.observation.metadata.steps": len(pv["steps"]),
        }),
        "status": {"code": 2 if failed else 1},
    }]
    from datetime import timedelta

    for run, st in zip(trace.runs, pv["steps"]):
        start = run.started_at
        end = start + timedelta(milliseconds=run.duration_ms or 0) if start else None
        is_generation = llm_trace and (run.provider or "") in LLM_PROVIDERS
        obs_type = "generation" if is_generation else STEP_TYPE.get(run.agent, "span")
        attrs: dict[str, Any] = {
            **ctx,
            "langfuse.observation.type": obs_type,
            "langfuse.observation.input": redact(run.input_summary or {}),
            "langfuse.observation.output": st["decision"],
            "langfuse.observation.level": "ERROR" if st["error"] else "DEFAULT",
            "langfuse.observation.status_message": (run.error or "")[:300] or None,
            "langfuse.observation.metadata.provider": st["provider"],
            "langfuse.observation.metadata.model": st["model"],
            "langfuse.observation.metadata.confidence": st["confidence"],
            "langfuse.observation.metadata.policy_refs": st["references"] or None,
        }
        if is_generation:
            attrs["langfuse.observation.model.name"] = run.model
            attrs["langfuse.observation.model.parameters"] = {"temperature": 0, "max_tokens": 1500, "response_format": "json"}
            attrs["langfuse.observation.usage_details"] = _usage(run)
        spans.append({
            "traceId": trace.trace_id, "spanId": secrets.token_hex(8), "parentSpanId": root_id, "name": st["agent"], "kind": 1,
            "startTimeUnixNano": _ns(start), "endTimeUnixNano": _ns(end),
            "attributes": _attrs(attrs),
            "status": {"code": 2, "message": (run.error or "")[:300]} if st["error"] else {"code": 1},
        })
    return {"resourceSpans": [{
        "resource": {"attributes": _attrs({"service.name": "grievance-backend", "service.version": RELEASE})},
        "scopeSpans": [{"scope": {"name": "grievance.tracing", "version": RELEASE}, "spans": spans}],
    }]}


def export_to_langfuse(trace: AgentTrace) -> str | None:
    """Send one finished trace to Langfuse over OTLP/HTTP (real-time ingestion, v4).

    Returns the verified Langfuse trace URL, or None when Langfuse is not configured or the export failed.
    A failed export never affects the grievance workflow."""
    s = get_settings()
    if not s.langfuse_enabled:
        return None
    try:
        payload = build_otlp_payload(trace)
        r = httpx.post(f"{s.langfuse_host.rstrip('/')}/api/public/otel/v1/traces", json=payload,
                       headers={**_lf_auth(), "Content-Type": "application/json", "x-langfuse-ingestion-version": "4"},
                       timeout=8.0)
        rejected = 0
        try:
            rejected = int(((r.json() or {}).get("partialSuccess") or {}).get("rejectedSpans") or 0)
        except (ValueError, AttributeError):
            pass
        if r.status_code < 300 and not rejected:
            pid = langfuse_project_id()
            if pid:
                trace.langfuse_url = f"{s.langfuse_host.rstrip('/')}/project/{pid}/traces/{trace.trace_id}"
                return trace.langfuse_url
            return None
        log.warning("Langfuse OTLP export returned %s (%d rejected spans)", r.status_code, rejected)
    except httpx.HTTPError as exc:
        log.warning("Langfuse export failed: %s", type(exc).__name__)
    except Exception:  # never let observability break a grievance workflow
        log.exception("Langfuse export failed while building the payload")
    return None
