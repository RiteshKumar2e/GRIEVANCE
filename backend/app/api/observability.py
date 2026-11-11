"""Observability API: agent traces (admin), shareable redacted trace links (public, token-gated)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import require_admin
from app.core.time import as_aware
from app.db.session import get_db
from app.models import AgentRun, AgentTrace, Grievance, User
from app.services.tracing import ensure_share_token, public_view

router = APIRouter(prefix="/observability", tags=["observability"])
public_router = APIRouter(prefix="/public", tags=["public"])


def _iso(dt):
    return as_aware(dt).isoformat() if dt else None


@router.get("/traces")
def list_traces(name: str | None = None, status: str | None = None, grievance: str | None = None,
                limit: int = Query(default=50, le=200), offset: int = 0,
                _: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(AgentTrace)
    if name:
        q = q.where(AgentTrace.name == name)
    if status:
        q = q.where(AgentTrace.status == status)
    if grievance:
        q = q.join(Grievance, Grievance.id == AgentTrace.grievance_id).where(Grievance.public_id == grievance)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(AgentTrace.id.desc()).offset(offset).limit(limit)).all()
    g_ids = {t.grievance_id for t in rows if t.grievance_id}
    pub = dict(db.execute(select(Grievance.id, Grievance.public_id).where(Grievance.id.in_(g_ids))).all()) if g_ids else {}
    return {"total": total, "langfuse_enabled": get_settings().langfuse_enabled, "items": [
        {"trace_id": t.trace_id, "name": t.name, "status": t.status, "grievance_id": pub.get(t.grievance_id),
         "started_at": _iso(t.started_at), "duration_ms": t.duration_ms, "steps": len(t.runs),
         "providers": sorted({r.provider for r in t.runs if r.provider}), "errors": sum(1 for r in t.runs if r.status == "error"),
         "shared": bool(t.share_token), "langfuse_url": t.langfuse_url}
        for t in rows]}


@router.get("/traces/{trace_id}")
def trace_detail(trace_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.scalar(select(AgentTrace).where(AgentTrace.trace_id == trace_id))
    if t is None:
        raise HTTPException(404, "Trace not found")
    g = db.get(Grievance, t.grievance_id) if t.grievance_id else None
    return {
        "trace_id": t.trace_id, "name": t.name, "status": t.status, "grievance_id": g.public_id if g else None,
        "started_at": _iso(t.started_at), "ended_at": _iso(t.ended_at), "duration_ms": t.duration_ms,
        "metadata": t.metadata_json, "share_token": t.share_token, "langfuse_url": t.langfuse_url,
        "steps": [{"id": r.id, "agent": r.agent, "status": r.status, "provider": r.provider, "model": r.model,
                   "confidence": r.confidence, "input": r.input_summary, "output": r.output, "references": r.references,
                   "error": r.error, "started_at": _iso(r.started_at), "duration_ms": r.duration_ms} for r in t.runs],
    }


@router.post("/traces/{trace_id}/share")
def share_trace(trace_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.scalar(select(AgentTrace).where(AgentTrace.trace_id == trace_id))
    if t is None:
        raise HTTPException(404, "Trace not found")
    token = ensure_share_token(t)
    db.commit()
    return {"share_token": token, "path": f"/share/trace/{token}", "langfuse_url": t.langfuse_url}


@router.delete("/traces/{trace_id}/share", status_code=204)
def unshare_trace(trace_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.scalar(select(AgentTrace).where(AgentTrace.trace_id == trace_id))
    if t is None:
        raise HTTPException(404, "Trace not found")
    t.share_token = None
    db.commit()


@router.get("/errors")
def recent_errors(limit: int = Query(default=50, le=200), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.execute(select(AgentRun, AgentTrace.trace_id).join(AgentTrace, AgentTrace.id == AgentRun.trace_id)
                      .where(AgentRun.status == "error").order_by(AgentRun.id.desc()).limit(limit)).all()
    return [{"trace_id": tid, "agent": r.agent, "error": r.error, "started_at": _iso(r.started_at)} for r, tid in rows]


@public_router.get("/traces/{token}")
def public_trace(token: str, db: Session = Depends(get_db)):
    """Shareable trace: structured agent decisions only — no complaint text, identities or chain-of-thought."""
    if len(token) < 20:
        raise HTTPException(404, "Not found")
    t = db.scalar(select(AgentTrace).where(AgentTrace.share_token == token))
    if t is None:
        raise HTTPException(404, "Not found")
    view = public_view(t)
    view["started_at"] = _iso(view["started_at"])
    return view
