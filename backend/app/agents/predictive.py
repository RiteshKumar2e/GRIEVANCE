"""Agent 5 — Predictive SLA & recurrence intelligence.

* Predicts resolution time and breach probability from historical resolution times of the same
  category/department, adjusted for the department's current backlog vs officer capacity.
* Scans open grievances: at-risk warnings, breach detection and early escalation.
* Detects recurring hotspots (category x ward) and department bottlenecks.

When the history is SYNTHETIC these numbers are demo estimates, not measured real-world accuracy;
every response carries `estimate_label` saying so.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Any

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.time import as_aware, utcnow
from app.models import Department, Grievance, GrievanceCategory, Officer, SlaRecord
from app.models.enums import OPEN_STATUSES, DataSource, GrievanceStatus, SlaState

OPEN = [s.value for s in OPEN_STATUSES]


def estimate_label(db: Session) -> str:
    sources = {s for (s,) in db.execute(select(Grievance.data_source).where(Grievance.is_historical.is_(True)).distinct())}
    if not sources or sources == {DataSource.SYNTHETIC.value}:
        return "Demo estimate based on SYNTHETIC history — not a measure of real-world accuracy."
    if DataSource.SYNTHETIC.value in sources:
        return "Estimate based on mixed OFFICIAL and SYNTHETIC history."
    return "Estimate based on OFFICIAL historical data."


def _resolution_hours(db: Session, *, category_id: int | None = None, department_id: int | None = None) -> list[float]:
    q = select(Grievance.created_at, Grievance.resolved_at).where(Grievance.resolved_at.is_not(None))
    if category_id:
        q = q.where(Grievance.category_id == category_id)
    elif department_id:
        q = q.where(Grievance.department_id == department_id)
    out = []
    for created, resolved in db.execute(q):
        h = (as_aware(resolved) - as_aware(created)).total_seconds() / 3600
        if h > 0:
            out.append(h)
    return out


def department_load(db: Session, department_id: int | None) -> dict[str, float]:
    if not department_id:
        return {"open": 0, "capacity": 1, "ratio": 0.0}
    open_count = db.scalar(select(func.count()).select_from(Grievance).where(
        Grievance.department_id == department_id, Grievance.status.in_(OPEN), Grievance.is_historical.is_(False))) or 0
    capacity = db.scalar(select(func.coalesce(func.sum(Officer.max_active_cases), 0)).where(
        Officer.department_id == department_id, Officer.is_active.is_(True))) or 1
    return {"open": int(open_count), "capacity": int(capacity), "ratio": round(open_count / max(1, capacity), 3)}


def predict(db: Session, g: Grievance, sla_hours: int) -> dict[str, Any]:
    hours = _resolution_hours(db, category_id=g.category_id)
    basis = "category"
    if len(hours) < 8:
        hours = _resolution_hours(db, department_id=g.department_id)
        basis = "department"
    load = department_load(db, g.department_id)
    load_factor = 1.0 + max(0.0, load["ratio"] - 0.6)  # backlog above 60% capacity slows resolution
    urgency_factor = {"critical": 0.7, "high": 0.85}.get(g.urgency, 1.0)
    if hours:
        arr = np.asarray(hours) * load_factor * urgency_factor
        predicted = float(np.median(arr))
        prob = float(np.mean(arr > sla_hours))
    else:
        predicted, prob, basis = float(sla_hours) * 0.8, 0.3, "default"
    return {
        "predicted_resolution_hours": round(predicted, 1),
        "breach_probability": round(prob, 3),
        "basis": basis,
        "sample_size": len(hours),
        "department_load": load,
        "load_factor": round(load_factor, 3),
        "estimate_label": estimate_label(db),
    }


def create_sla_record(db: Session, g: Grievance, sla_hours: int, due_at: datetime) -> SlaRecord:
    pred = predict(db, g, sla_hours)
    rec = SlaRecord(
        grievance_id=g.id, sla_hours=sla_hours, due_at=due_at, state=SlaState.ON_TRACK.value,
        predicted_resolution_hours=pred["predicted_resolution_hours"], breach_probability=pred["breach_probability"],
        prediction_basis=pred, last_checked_at=utcnow(),
    )
    db.add(rec)
    g.sla_record = rec
    return rec


def assess(g: Grievance, rec: SlaRecord, now: datetime) -> str:
    """Return the SLA state an open grievance *should* be in right now."""
    s = get_settings()
    due = as_aware(rec.due_at)
    created = as_aware(g.created_at)
    if now >= due:
        return SlaState.BREACHED.value
    total = max(1.0, (due - created).total_seconds())
    elapsed = (now - created).total_seconds() / total
    if elapsed >= s.sla_warning_fraction:
        return SlaState.AT_RISK.value
    if (rec.breach_probability or 0) >= 0.6 and elapsed >= 0.5:
        return SlaState.AT_RISK.value  # early warning driven by the prediction
    return SlaState.ON_TRACK.value


def recurrence(db: Session, days: int = 30, min_count: int = 3) -> list[dict[str, Any]]:
    now = utcnow()
    cur_from, prev_from = now - timedelta(days=days), now - timedelta(days=2 * days)
    rows = db.execute(
        select(Grievance.category_id, Grievance.ward, Grievance.created_at).where(Grievance.created_at >= prev_from, Grievance.ward.is_not(None))
    ).all()
    cur, prev = Counter(), Counter()
    for cat_id, ward, created in rows:
        (cur if as_aware(created) >= cur_from else prev)[(cat_id, ward)] += 1
    cats = {c.id: c for c in db.scalars(select(GrievanceCategory))}
    out = []
    for (cat_id, ward), n in cur.items():
        if n < min_count:
            continue
        p = prev.get((cat_id, ward), 0)
        growth = (n - p) / p if p else None
        c = cats.get(cat_id)
        out.append({
            "category_code": c.code if c else None, "category_name": c.name_en if c else "Unknown",
            "ward": ward, "count": n, "previous_count": p,
            "growth": round(growth, 2) if growth is not None else None,
            "is_hotspot": n >= max(min_count, 5) or (growth is not None and growth >= 0.5),
        })
    return sorted(out, key=lambda r: r["count"], reverse=True)


def bottlenecks(db: Session) -> list[dict[str, Any]]:
    now = utcnow()
    out = []
    for d in db.scalars(select(Department).where(Department.is_active.is_(True))):
        open_rows = db.execute(select(Grievance.created_at, Grievance.sla_due_at).where(
            Grievance.department_id == d.id, Grievance.status.in_(OPEN), Grievance.is_historical.is_(False))).all()
        overdue = sum(1 for _, due in open_rows if due and as_aware(due) < now)
        ages = [(now - as_aware(c)).total_seconds() / 86400 for c, _ in open_rows]
        hist = _resolution_hours(db, department_id=d.id)
        load = department_load(db, d.id)
        score = 0.5 * min(1.0, load["ratio"]) + 0.5 * (overdue / len(open_rows) if open_rows else 0)
        out.append({
            "department_code": d.code, "department_name": d.name, "open": len(open_rows), "overdue": overdue,
            "avg_open_age_days": round(sum(ages) / len(ages), 1) if ages else 0.0,
            "median_resolution_hours": round(median(hist), 1) if hist else None,
            "capacity": load["capacity"], "load_ratio": load["ratio"], "bottleneck_score": round(score, 3),
            "is_bottleneck": score >= 0.35 and len(open_rows) >= 3,
        })
    return sorted(out, key=lambda r: r["bottleneck_score"], reverse=True)


def officer_workload(db: Session) -> list[dict[str, Any]]:
    counts = defaultdict(int)
    for off_id, in db.execute(select(Grievance.assigned_officer_id).where(
            Grievance.status.in_(OPEN), Grievance.assigned_officer_id.is_not(None), Grievance.is_historical.is_(False))):
        counts[off_id] += 1
    out = []
    for o in db.scalars(select(Officer).where(Officer.is_active.is_(True))):
        n = counts.get(o.id, 0)
        out.append({"officer_code": o.code, "name": o.name, "department_code": o.department.code if o.department else None,
                    "open_cases": n, "capacity": o.max_active_cases, "utilisation": round(n / max(1, o.max_active_cases), 3)})
    return sorted(out, key=lambda r: r["utilisation"], reverse=True)
