"""Built-in mock webhook receiver.

Stands in for an n8n / Zapier "Catch Hook" during demos so webhook triggering can be shown end to end
without external services. It verifies the HMAC signature exactly as an n8n workflow would and keeps the
last 50 deliveries in memory (payloads contain no citizen PII by design)."""
from __future__ import annotations

import json
from collections import deque
from threading import Lock
from typing import Any

from fastapi import APIRouter, Depends, Request

from app.core.deps import require_admin
from app.core.ratelimit import limiter
from app.core.time import utcnow
from app.services.webhooks import verify
from app.models import User

router = APIRouter(prefix="/mock", tags=["mock integrations"])
_received: deque[dict[str, Any]] = deque(maxlen=50)
_lock = Lock()


@router.post("/webhook-receiver")
async def receive(request: Request):
    """Accepts GRIEVANCE webhook deliveries and checks the timestamped `X-Grievance-Signature` HMAC."""
    limiter.check(request, "mock-receiver", limit=300, window=60)
    body = await request.body()
    valid, reason = verify(body, request.headers.get("x-grievance-signature", ""), request.headers.get("x-grievance-timestamp", ""))
    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        payload = {"_raw": body[:200].decode("utf-8", "replace")}
    with _lock:
        _received.appendleft({"received_at": utcnow().isoformat(), "event": request.headers.get("x-grievance-event"),
                              "delivery_id": request.headers.get("x-grievance-delivery"),
                              "signature_valid": valid, "verification": reason, "payload": payload})
    return {"ok": True, "signature_valid": valid, "verification": reason}


@router.get("/webhook-receiver")
def list_received(_: User = Depends(require_admin)):
    with _lock:
        return {"count": len(_received), "items": list(_received)}
