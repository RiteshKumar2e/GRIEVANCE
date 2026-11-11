"""Agent 2 — Policy & safety enforcement (deterministic, no LLM).

Every AI decision passes through `evaluate`. It applies the Category Master (department, SLA,
sensitive flag, identity hiding, confidence threshold) and returns the only set of actions the
AI is allowed to take for this grievance.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.models import GrievanceCategory
from app.services.grievances import POLICY_TEXT

# The AI may only ever perform these; closing/rejecting/liability are never in the list.
BASE_AI_ACTIONS = ["assign_department", "assign_officer", "notify", "escalate", "link_duplicates", "retrieve_precedents"]
NEVER_AI_ACTIONS = ["reject", "determine_liability", "close_sensitive", "release_from_review"]


@dataclass
class PolicyDecision:
    category_code: str
    department_id: int | None
    department_code: str | None
    sla_hours: int
    sla_due_at: datetime
    is_sensitive: bool
    hide_identity: bool
    confidence: float
    threshold: float
    requires_human_review: bool
    review_reasons: list[str] = field(default_factory=list)
    policy_refs: list[str] = field(default_factory=list)
    allowed_ai_actions: list[str] = field(default_factory=list)
    forbidden_ai_actions: list[str] = field(default_factory=lambda: list(NEVER_AI_ACTIONS))
    auto_close_allowed: bool = False
    reasoning: list[str] = field(default_factory=list)  # each rule checked and its outcome

    def explanation(self) -> dict[str, Any]:
        d = asdict(self)
        d["sla_due_at"] = self.sla_due_at.isoformat()
        d["policy_text"] = {ref: POLICY_TEXT[ref] for ref in self.policy_refs if ref in POLICY_TEXT}
        return d


def evaluate(
    category: GrievanceCategory,
    *,
    confidence: float,
    submitted_at: datetime,
    urgency: str = "medium",
    injection_suspected: bool = False,
    sensitive_signals: list[str] | None = None,
    llm_used: bool = False,
) -> PolicyDecision:
    s = get_settings()
    refs = ["POL-NOREJECT-01", "POL-LIABILITY-01", "POL-SLA-01"]
    if llm_used:
        refs.append("POL-LLM-01")
    reasons: list[str] = []

    threshold = category.confidence_threshold if category.confidence_threshold is not None else s.default_confidence_threshold
    review = False
    trail = [f"Category Master entry {category.code}: department {category.department.code if category.department else 'none'}, "
             f"SLA {category.sla_hours} h, sensitive={category.is_sensitive}, identity hiding={category.hide_identity}, threshold {threshold:.2f}"]

    if category.is_sensitive:
        review = True
        reasons.append("Sensitive category: mandatory human review.")
        refs += ["POL-SENSITIVE-01", "POL-SENSITIVE-02"]
    if category.hide_identity:
        refs.append("POL-IDENTITY-01")
    if confidence < threshold:
        review = True
        reasons.append(f"Classification confidence {confidence:.2f} is below the category threshold {threshold:.2f}.")
        refs.append("POL-CONF-01")
    if injection_suspected:
        review = True
        reasons.append("Complaint text contains instruction-like content; a human must verify the classification.")
        refs.append("POL-INJECT-01")
    other_sensitive = [c for c in (sensitive_signals or []) if c != category.code]
    if other_sensitive and not category.is_sensitive:
        review = True
        reasons.append(f"Text contains indicators of a sensitive category ({', '.join(other_sensitive)}); a human must verify.")
        refs.append("POL-SENSITIVE-01")
    trail.append(f"POL-SENSITIVE-01 sensitive category: {'YES, human review required' if category.is_sensitive else 'no'}")
    trail.append(f"POL-CONF-01 confidence {confidence:.2f} vs threshold {threshold:.2f}: {'BELOW, human review required' if confidence < threshold else 'pass'}")
    trail.append(f"POL-INJECT-01 instruction-like text: {'YES, human review required' if injection_suspected else 'none'}")
    trail.append(f"Sensitive indicators for other categories: {', '.join(other_sensitive) if other_sensitive else 'none'}")
    if category.department_id is None:
        review = True
        reasons.append("Category has no mapped department in the Category Master.")

    sla_hours = int(category.sla_hours or 72)
    if urgency == "critical":
        sla_hours = max(4, min(sla_hours, 24))
    auto_close = bool(category.auto_close_allowed and not category.is_sensitive)
    if auto_close:
        refs.append("POL-AUTOCLOSE-01")

    allowed = [a for a in BASE_AI_ACTIONS if not (review and a == "assign_officer")]
    trail.append(f"SLA: {sla_hours} h" + (" (shortened for critical urgency)" if sla_hours != int(category.sla_hours or 72) else " from Category Master"))
    trail.append("Outcome: " + ("route to HUMAN REVIEW; AI may not assign an officer" if review else "AI may assign department and officer"))
    trail.append("Always forbidden for AI: " + ", ".join(NEVER_AI_ACTIONS))
    return PolicyDecision(
        category_code=category.code,
        department_id=category.department_id,
        department_code=category.department.code if category.department else None,
        sla_hours=sla_hours,
        sla_due_at=submitted_at + timedelta(hours=sla_hours),
        is_sensitive=bool(category.is_sensitive),
        hide_identity=bool(category.hide_identity or category.is_sensitive),
        confidence=round(confidence, 3),
        threshold=threshold,
        requires_human_review=review,
        review_reasons=reasons,
        policy_refs=sorted(set(refs)),
        allowed_ai_actions=allowed,
        auto_close_allowed=auto_close,
        reasoning=trail,
    )


def assert_ai_action_allowed(decision: PolicyDecision | dict, action: str) -> None:
    from app.core.errors import PolicyViolation

    allowed = decision.allowed_ai_actions if isinstance(decision, PolicyDecision) else decision.get("allowed_ai_actions", [])
    if action in NEVER_AI_ACTIONS or action not in allowed:
        raise PolicyViolation(f"AI action '{action}' is not permitted by the policy gate.", details={"action": action})
