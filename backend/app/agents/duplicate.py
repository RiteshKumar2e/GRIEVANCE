"""Agent 4 — Duplicate detection & grouping.

Scores open, recent, non-historical grievances against a new one using semantic similarity,
geographic distance, time proximity and category match. Matches are *linked* into a
DuplicateGroup. Every grievance keeps its own ID, status, notifications and audit trail;
nothing is merged or deleted (POL-DUP-01).
"""
from __future__ import annotations

import math
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.time import as_aware
from app.llm.embeddings import cosine
from app.models import DuplicateGroup, DuplicateGroupMember, Grievance
from app.models.enums import OPEN_STATUSES

WEIGHTS = {"semantic": 0.55, "geo": 0.20, "time": 0.15, "category": 0.10}


@dataclass
class DuplicateMatch:
    grievance: Grievance
    score: float
    signals: dict[str, float]


def haversine_km(lat1, lon1, lat2, lon2) -> float | None:
    if None in (lat1, lon1, lat2, lon2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def score_pair(new: Grievance, other: Grievance) -> DuplicateMatch:
    s = get_settings()
    semantic = max(0.0, cosine(new.embedding, other.embedding))
    dist = haversine_km(new.latitude, new.longitude, other.latitude, other.longitude)
    if dist is not None:
        geo = max(0.0, 1.0 - dist / s.duplicate_radius_km)
    elif new.ward and other.ward:
        geo = 1.0 if new.ward == other.ward else 0.0
    else:
        geo = 0.3  # unknown location: weak neutral evidence
    hours = abs((as_aware(new.created_at) - as_aware(other.created_at)).total_seconds()) / 3600
    window = s.duplicate_window_days * 24
    time_score = max(0.0, 1.0 - hours / window)
    category = 1.0 if new.category_id and new.category_id == other.category_id else 0.0
    signals = {"semantic": round(semantic, 3), "geo": round(geo, 3), "time": round(time_score, 3),
               "category": category, "distance_km": round(dist, 3) if dist is not None else None}
    score = sum(WEIGHTS[k] * signals[k] for k in WEIGHTS)
    return DuplicateMatch(other, round(score, 4), signals)


def thresholds(embedding_model: str | None) -> tuple[float, float]:
    """(overall score threshold, minimum semantic similarity) for the embedder in use.

    The hashing fallback embedder produces much lower cosine values for paraphrases than the
    multilingual transformer, so it needs calibrated (lower) cut-offs; it is also language-bound,
    which is why category, geography and time carry more of the decision in that mode."""
    s = get_settings()
    if embedding_model and embedding_model.startswith("hashing"):
        return min(s.duplicate_threshold, 0.62), 0.25
    return s.duplicate_threshold, 0.60


def find_duplicates(db: Session, g: Grievance, limit: int = 5) -> list[DuplicateMatch]:
    s = get_settings()
    since = as_aware(g.created_at) - timedelta(days=s.duplicate_window_days)
    q = select(Grievance).where(
        Grievance.id != g.id,
        Grievance.is_historical.is_(False),
        Grievance.status.in_([st.value for st in OPEN_STATUSES]),
        Grievance.created_at >= since,
        Grievance.embedding.is_not(None),
    )
    if g.department_id:
        q = q.where(Grievance.department_id == g.department_id)
    threshold, min_semantic = thresholds(g.embedding_model)
    matches = [score_pair(g, other) for other in db.scalars(q) if other.embedding_model == g.embedding_model]
    # Require the semantic signal itself to be meaningful, not just geography + time.
    matches = [m for m in matches if m.score >= threshold and m.signals["semantic"] >= min_semantic]
    return sorted(matches, key=lambda m: m.score, reverse=True)[:limit]


def link(db: Session, g: Grievance, matches: list[DuplicateMatch], linked_by: str = "AI_SYSTEM") -> DuplicateGroup | None:
    if not matches:
        return None
    best = matches[0]
    # Join the first existing group among the matches (load by id: the relationship may be stale).
    group_id = next((m.grievance.duplicate_group_id for m in matches if m.grievance.duplicate_group_id), None)
    group = db.get(DuplicateGroup, group_id) if group_id else None
    if group is not None and best.grievance.duplicate_group_id != group.id:
        best = next(m for m in matches if m.grievance.duplicate_group_id == group.id)
    if group is None:
        group = DuplicateGroup(
            public_id=f"DUP-{secrets.token_hex(3).upper()}",
            category_id=g.category_id, ward=g.ward or best.grievance.ward,
            label=f"{g.category.name_en if g.category else 'Related grievances'}, {g.ward or best.grievance.ward or 'nearby'}",
            created_by=linked_by,
        )
        db.add(group)
        db.flush()
        best.grievance.duplicate_group_id = group.id
        db.add(DuplicateGroupMember(group_id=group.id, grievance_id=best.grievance.id, score=1.0,
                                    signals={"role": "first_report"}, linked_by=linked_by))
    g.duplicate_group_id = group.id
    db.add(DuplicateGroupMember(group_id=group.id, grievance_id=g.id, matched_grievance_id=best.grievance.id,
                                score=best.score, signals=best.signals, linked_by=linked_by))
    return group
