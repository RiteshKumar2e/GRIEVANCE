"""Agent 3 — RAG precedent retrieval.

Embeds the grievance and retrieves the top-k most similar *resolved* grievances (historical
imports and resolved live cases) using pgvector cosine distance on PostgreSQL, or an in-process
NumPy scan on SQLite. Filtering widens from category -> department -> all.

Precedents are supporting evidence for officers only; they never decide an outcome.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.privacy import redact_text
from app.core.time import as_aware
from app.db.session import is_postgres
from app.models import Grievance, RetrievedPrecedent
from app.models.enums import GrievanceStatus

RESOLVED = [GrievanceStatus.RESOLVED.value, GrievanceStatus.CLOSED.value]
MIN_SIMILARITY = 0.15


@dataclass
class Precedent:
    grievance: Grievance
    similarity: float
    scope: str

    def summary(self) -> str:
        g = self.grievance
        days = None
        if g.resolved_at and g.created_at:
            days = round((as_aware(g.resolved_at) - as_aware(g.created_at)).total_seconds() / 86400, 1)
        took = f"resolved in {days} days" if days is not None else "resolved"
        where = g.ward or "unknown ward"
        resolution = g.resolution_summary or "Resolution details not recorded."
        return f"{g.public_id} ({where}, {took}): {redact_text(resolution, 240)}"


def _candidates_sqlite(db: Session, vec: list[float], filters: dict[str, Any], exclude_id: int | None, k: int) -> list[tuple[Grievance, float]]:
    q = select(Grievance).where(Grievance.status.in_(RESOLVED), Grievance.embedding.is_not(None))
    if exclude_id:
        q = q.where(Grievance.id != exclude_id)
    for col, val in filters.items():
        q = q.where(getattr(Grievance, col) == val)
    rows = db.scalars(q).all()
    if not rows:
        return []
    mat = np.asarray([r.embedding for r in rows], dtype=np.float32)
    v = np.asarray(vec, dtype=np.float32)
    sims = mat @ v / (np.linalg.norm(mat, axis=1) * (np.linalg.norm(v) or 1.0) + 1e-9)
    order = np.argsort(-sims)[:k]
    return [(rows[i], float(sims[i])) for i in order]


def _candidates_pg(db: Session, vec: list[float], filters: dict[str, Any], exclude_id: int | None, k: int) -> list[tuple[Grievance, float]]:
    where = ["status = ANY(:statuses)", "embedding IS NOT NULL"]
    params: dict[str, Any] = {"statuses": RESOLVED, "q": str(list(map(float, vec))), "k": k}
    if exclude_id:
        where.append("id != :exclude")
        params["exclude"] = exclude_id
    for col, val in filters.items():
        where.append(f"{col} = :{col}")
        params[col] = val
    sql = text(
        f"SELECT id, 1 - (embedding <=> CAST(:q AS vector)) AS sim FROM grievances "
        f"WHERE {' AND '.join(where)} ORDER BY embedding <=> CAST(:q AS vector) LIMIT :k"
    )
    hits = db.execute(sql, params).all()
    by_id = {g.id: g for g in db.scalars(select(Grievance).where(Grievance.id.in_([h.id for h in hits])))}
    return [(by_id[h.id], float(h.sim)) for h in hits if h.id in by_id]


def retrieve(
    db: Session,
    vec: list[float],
    *,
    category_id: int | None,
    department_id: int | None,
    exclude_id: int | None = None,
    k: int = 5,
) -> list[Precedent]:
    search = _candidates_pg if is_postgres() else _candidates_sqlite
    scopes: list[tuple[str, dict[str, Any]]] = []
    if category_id:
        scopes.append(("category", {"category_id": category_id}))
    if department_id:
        scopes.append(("department", {"department_id": department_id}))
    scopes.append(("all", {}))

    seen: set[int] = set()
    found: list[Precedent] = []
    for scope, filters in scopes:
        for g, sim in search(db, vec, filters, exclude_id, k):
            if g.id in seen or sim < MIN_SIMILARITY:
                continue
            seen.add(g.id)
            found.append(Precedent(g, round(sim, 4), scope))
        if len(found) >= k:
            break
    found.sort(key=lambda p: (p.scope != "category", -p.similarity))
    return found[:k]


def store(db: Session, grievance: Grievance, precedents: list[Precedent], trace_id: str | None) -> list[RetrievedPrecedent]:
    rows = []
    for rank, p in enumerate(precedents, start=1):
        row = RetrievedPrecedent(
            grievance_id=grievance.id, precedent_id=p.grievance.id, rank=rank, similarity=p.similarity,
            summary=p.summary(), filter_scope=p.scope, trace_id=trace_id,
        )
        db.add(row)
        rows.append(row)
    return rows


def guidance(precedents: list[Precedent]) -> str:
    """Deterministic, evidence-only guidance (no outcome decision)."""
    if not precedents:
        return "No comparable resolved grievances were found. Proceed on the merits of this case."
    days = []
    for p in precedents:
        g = p.grievance
        if g.resolved_at and g.created_at:
            days.append((as_aware(g.resolved_at) - as_aware(g.created_at)).total_seconds() / 86400)
    typical = f" Comparable cases were typically resolved in about {np.median(days):.1f} days." if days else ""
    return (
        f"{len(precedents)} similar resolved case(s) found.{typical} Most relevant action taken: "
        f"\"{redact_text(precedents[0].grievance.resolution_summary or 'not recorded', 200)}\". "
        "These precedents are supporting evidence only."
    )
