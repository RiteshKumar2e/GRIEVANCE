"""Analytics for the administrator dashboard. Every number is computed from the database."""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from statistics import median

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents import predictive
from app.core.deps import require_admin
from app.core.time import as_aware, utcnow
from app.db.session import get_db
from app.models import AgentRun, AgentTrace, AuditEvent, PageView, Department, Grievance, GrievanceCategory, SlaRecord, User
from app.models.enums import OPEN_STATUSES, GrievanceStatus, SlaState

router = APIRouter(prefix="/analytics", tags=["analytics"])
OPEN = [s.value for s in OPEN_STATUSES]


def _scope(q, include_history: bool):
    return q if include_history else q.where(Grievance.is_historical.is_(False))


@router.get("/overview")
def overview(include_history: bool = Query(default=True), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    base = _scope(select(Grievance), include_history).subquery()
    by_status = dict(db.execute(select(base.c.status, func.count()).group_by(base.c.status)).all())
    by_source = dict(db.execute(select(base.c.data_source, func.count()).group_by(base.c.data_source)).all())
    total = sum(by_status.values())
    resolved_rows = db.execute(select(base.c.created_at, base.c.resolved_at, base.c.sla_due_at).where(base.c.resolved_at.is_not(None))).all()
    hours = [(as_aware(r) - as_aware(c)).total_seconds() / 3600 for c, r, _ in resolved_rows]
    met = sum(1 for c, r, d in resolved_rows if d and as_aware(r) <= as_aware(d))
    live = select(Grievance).where(Grievance.is_historical.is_(False))
    now = utcnow()
    open_live = db.scalars(live.where(Grievance.status.in_(OPEN))).all()
    return {
        "total": total,
        "by_status": by_status,
        "by_data_source": by_source,
        "open": sum(by_status.get(s, 0) for s in OPEN),
        "resolved": by_status.get(GrievanceStatus.RESOLVED.value, 0) + by_status.get(GrievanceStatus.CLOSED.value, 0),
        "pending_review": by_status.get(GrievanceStatus.PENDING_REVIEW.value, 0),
        "sensitive_open": sum(1 for g in open_live if g.is_sensitive),
        "overdue_open": sum(1 for g in open_live if g.sla_due_at and as_aware(g.sla_due_at) < now),
        "escalated_open": sum(1 for g in open_live if g.escalation_level > 0),
        "median_resolution_hours": round(median(hours), 1) if hours else None,
        "sla_compliance": round(met / len(resolved_rows), 3) if resolved_rows else None,
        "reopened_total": db.scalar(_scope(select(func.count()).select_from(Grievance).where(Grievance.reopen_count > 0), include_history)) or 0,
        "estimate_label": predictive.estimate_label(db),
        "include_history": include_history,
    }


@router.get("/departments")
def departments(include_history: bool = True, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    out = []
    now = utcnow()
    for d in db.scalars(select(Department).where(Department.is_active.is_(True)).order_by(Department.name)):
        rows = db.execute(_scope(select(Grievance.status, Grievance.created_at, Grievance.resolved_at, Grievance.sla_due_at)
                                 .where(Grievance.department_id == d.id), include_history)).all()
        if not rows:
            out.append({"code": d.code, "name": d.name, "total": 0, "open": 0, "resolved": 0, "overdue": 0,
                        "sla_compliance": None, "median_resolution_hours": None})
            continue
        resolved = [r for r in rows if r.resolved_at]
        met = sum(1 for r in resolved if r.sla_due_at and as_aware(r.resolved_at) <= as_aware(r.sla_due_at))
        hrs = [(as_aware(r.resolved_at) - as_aware(r.created_at)).total_seconds() / 3600 for r in resolved]
        out.append({
            "code": d.code, "name": d.name, "total": len(rows),
            "open": sum(1 for r in rows if r.status in OPEN),
            "resolved": len(resolved),
            "overdue": sum(1 for r in rows if r.status in OPEN and r.sla_due_at and as_aware(r.sla_due_at) < now),
            "sla_compliance": round(met / len(resolved), 3) if resolved else None,
            "median_resolution_hours": round(median(hrs), 1) if hrs else None,
        })
    return out


@router.get("/trends")
def trends(days: int = Query(default=90, ge=7, le=365), include_history: bool = True,
           _: User = Depends(require_admin), db: Session = Depends(get_db)):
    since = utcnow() - timedelta(days=days)
    bucket = "week" if days > 60 else "day"

    def key(dt):
        dt = as_aware(dt)
        if bucket == "week":
            start = dt - timedelta(days=dt.weekday())
            return start.date().isoformat()
        return dt.date().isoformat()

    created, resolved, escalations = defaultdict(int), defaultdict(int), defaultdict(int)
    for (c,) in db.execute(_scope(select(Grievance.created_at).where(Grievance.created_at >= since), include_history)):
        created[key(c)] += 1
    for (r,) in db.execute(_scope(select(Grievance.resolved_at).where(Grievance.resolved_at >= since), include_history)):
        resolved[key(r)] += 1
    for (e,) in db.execute(select(AuditEvent.created_at).where(AuditEvent.action.like("escalation%"), AuditEvent.created_at >= since)):
        escalations[key(e)] += 1
    keys = sorted(set(created) | set(resolved) | set(escalations))
    return {"bucket": bucket, "series": [{"period": k, "created": created[k], "resolved": resolved[k], "escalations": escalations[k]} for k in keys]}


@router.get("/categories")
def categories(include_history: bool = True, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.execute(_scope(select(GrievanceCategory.code, GrievanceCategory.name_en, func.count(Grievance.id))
                             .join(Grievance, Grievance.category_id == GrievanceCategory.id)
                             .group_by(GrievanceCategory.code, GrievanceCategory.name_en), include_history)).all()
    return sorted([{"code": c, "name": n, "count": k} for c, n, k in rows], key=lambda r: r["count"], reverse=True)


@router.get("/sla")
def sla(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    states = dict(db.execute(select(SlaRecord.state, func.count()).group_by(SlaRecord.state)).all())
    at_risk = db.execute(select(Grievance, SlaRecord).join(SlaRecord, SlaRecord.grievance_id == Grievance.id)
                         .where(SlaRecord.state.in_([SlaState.AT_RISK.value, SlaState.BREACHED.value]),
                                Grievance.status.in_(OPEN)).order_by(SlaRecord.due_at).limit(50)).all()
    return {
        "states": states,
        "estimate_label": predictive.estimate_label(db),
        "watchlist": [{"public_id": g.public_id, "title": g.title, "department": g.department.code if g.department else None,
                       "state": r.state, "due_at": as_aware(r.due_at).isoformat(), "breach_probability": r.breach_probability,
                       "predicted_resolution_hours": r.predicted_resolution_hours, "escalation_level": g.escalation_level,
                       "is_sensitive": g.is_sensitive}
                      for g, r in at_risk],
    }


@router.get("/recurrence")
def recurrence(days: int = Query(default=30, ge=7, le=180), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {"window_days": days, "items": predictive.recurrence(db, days=days), "estimate_label": predictive.estimate_label(db)}


@router.get("/bottlenecks")
def bottlenecks(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {"departments": predictive.bottlenecks(db), "officers": predictive.officer_workload(db)}


@router.get("/agents")
def agent_activity(days: int = Query(default=7, ge=1, le=90), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    since = utcnow() - timedelta(days=days)
    rows = db.execute(select(AgentRun.agent, AgentRun.status, func.count(), func.avg(AgentRun.duration_ms), func.avg(AgentRun.confidence))
                      .where(AgentRun.started_at >= since).group_by(AgentRun.agent, AgentRun.status)).all()
    agents: dict[str, dict] = {}
    for agent, status, n, avg_ms, avg_conf in rows:
        a = agents.setdefault(agent, {"agent": agent, "runs": 0, "errors": 0, "avg_ms": 0.0, "avg_confidence": None})
        a["runs"] += n
        if status == "error":
            a["errors"] += n
        a["avg_ms"] = round(float(avg_ms or 0), 1)
        a["avg_confidence"] = round(float(avg_conf), 3) if avg_conf is not None else a["avg_confidence"]
    providers = dict(db.execute(select(AgentRun.provider, func.count()).where(AgentRun.started_at >= since, AgentRun.agent == "intake")
                                .group_by(AgentRun.provider)).all())
    ai_actions = dict(db.execute(select(AuditEvent.action, func.count()).where(AuditEvent.actor == "AI_SYSTEM", AuditEvent.created_at >= since)
                                 .group_by(AuditEvent.action)).all())
    human_reviews = db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "review.decision",
                                                                               AuditEvent.created_at >= since)) or 0
    traces = db.scalar(select(func.count()).select_from(AgentTrace).where(AgentTrace.started_at >= since)) or 0
    return {"window_days": days, "traces": traces, "agents": sorted(agents.values(), key=lambda a: a["agent"]),
            "intake_providers": providers, "ai_actions": ai_actions, "human_review_decisions": human_reviews}


@router.get("/pageviews")
def pageviews(days: int = Query(default=30, ge=1, le=365), _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Anonymous, consent-based page-view counts (first-party; no third-party analytics)."""
    since = (utcnow() - timedelta(days=days)).date()
    by_path = db.execute(select(PageView.path, func.sum(PageView.count)).where(PageView.day >= since)
                         .group_by(PageView.path).order_by(func.sum(PageView.count).desc()).limit(25)).all()
    by_day = db.execute(select(PageView.day, func.sum(PageView.count)).where(PageView.day >= since)
                        .group_by(PageView.day).order_by(PageView.day)).all()
    return {"window_days": days, "total": sum(int(n) for _, n in by_path),
            "top_pages": [{"path": p, "views": int(n)} for p, n in by_path],
            "by_day": [{"day": d.isoformat(), "views": int(n)} for d, n in by_day]}
