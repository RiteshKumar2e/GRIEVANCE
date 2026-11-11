"""Outgoing webhooks: events are queued in the DB inside the business transaction and
delivered afterwards (HMAC-SHA256 signed). Payloads never contain citizen PII."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.time import utcnow
from app.db.session import SessionLocal
from app.models import Grievance, Webhook, WebhookDelivery

log = logging.getLogger("grievance.webhooks")

EVENTS = [
    "grievance.created", "grievance.assigned", "grievance.review_required", "grievance.status_changed",
    "grievance.escalated", "grievance.sla_at_risk", "grievance.duplicate_linked", "grievance.reopened",
]


def grievance_payload(g: Grievance) -> dict[str, Any]:
    return {
        "grievance_id": g.public_id,
        "status": g.status,
        "category": g.category.code if g.category else None,
        "department": g.department.code if g.department else None,
        "urgency": g.urgency,
        "ward": g.ward,
        "is_sensitive": g.is_sensitive,
        "escalation_level": g.escalation_level,
        "sla_due_at": g.sla_due_at.isoformat() if g.sla_due_at else None,
        "data_source": g.data_source,
    }


def queue_event(db: Session, event: str, payload: dict[str, Any]) -> int:
    hooks = db.scalars(select(Webhook).where(Webhook.is_active.is_(True))).all()
    n = 0
    for h in hooks:
        if h.events and event not in h.events:
            continue
        db.add(WebhookDelivery(webhook_id=h.id, event=event, payload={"event": event, "data": payload, "sent_at": utcnow().isoformat()}))
        n += 1
    return n


def sign(body: bytes) -> str:
    return hmac.new(get_settings().webhook_signing_secret.encode(), body, hashlib.sha256).hexdigest()


def deliver_pending(limit: int = 50) -> int:
    """Deliver queued webhooks. Safe to call from a background task."""
    delivered = 0
    with SessionLocal() as db:
        rows = db.scalars(
            select(WebhookDelivery).where(WebhookDelivery.status == "pending").order_by(WebhookDelivery.id).limit(limit)
        ).all()
        for d in rows:
            hook = db.get(Webhook, d.webhook_id)
            if hook is None or not hook.is_active:
                d.status = "failed"
                d.last_error = "webhook disabled"
                continue
            body = json.dumps(d.payload, ensure_ascii=False).encode("utf-8")
            d.attempts += 1
            try:
                r = httpx.post(
                    hook.url, content=body, timeout=5.0,
                    headers={"Content-Type": "application/json", "X-Grievance-Event": d.event,
                             "X-Grievance-Signature": f"sha256={sign(body)}"},
                )
                d.response_code = r.status_code
                if 200 <= r.status_code < 300:
                    d.status, d.delivered_at = "delivered", utcnow()
                    delivered += 1
                elif d.attempts >= 3:
                    d.status, d.last_error = "failed", f"HTTP {r.status_code}"
                else:
                    d.last_error = f"HTTP {r.status_code}"
            except httpx.HTTPError as exc:
                d.last_error = type(exc).__name__
                if d.attempts >= 3:
                    d.status = "failed"
        db.commit()
    return delivered
