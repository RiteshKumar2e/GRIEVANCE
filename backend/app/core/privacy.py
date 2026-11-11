"""Privacy helpers: PII redaction for logs/traces and identity masking for officer views."""
from __future__ import annotations

import re
from typing import Any

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
_AADHAAR = re.compile(r"(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)")

PROTECTED_NAME = "Identity protected"


def redact_text(text: str | None, limit: int | None = None) -> str:
    if not text:
        return ""
    out = _EMAIL.sub("[email]", text)
    out = _AADHAAR.sub("[id-number]", out)
    out = _PHONE.sub("[phone]", out)
    if limit and len(out) > limit:
        out = out[:limit] + "…"
    return out


def redact(obj: Any) -> Any:
    """Recursively redact strings inside dicts/lists."""
    if isinstance(obj, str):
        return redact_text(obj)
    if isinstance(obj, dict):
        return {k: redact(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def mask_name(name: str | None) -> str:
    if not name:
        return "n/a"
    parts = name.split()
    return " ".join(p[0] + "•" * max(1, len(p) - 1) for p in parts)


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return "•" * max(0, len(digits) - 2) + digits[-2:]
