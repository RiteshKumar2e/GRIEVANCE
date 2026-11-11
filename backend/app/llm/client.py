"""LLM provider chain: Groq (primary) -> Gemini (fallback) -> deterministic rules.

Design rules
- LLM output is *advisory*. Every result is validated against a schema here and then
  passed through the deterministic policy gate (`app.agents.policy`).
- Citizen text is untrusted. It is only ever placed inside a delimited data block in the
  user message — never concatenated into the system instructions.
- When no provider is configured or every provider fails, `complete_json` returns
  `None` and callers use their rule-based path. The caller records which provider ran.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings

log = logging.getLogger("grievance.llm")

FALLBACK_PROVIDER = "deterministic-rules"
FALLBACK_MODEL = "rules-v1"


@dataclass
class LLMResult:
    data: dict[str, Any] | None
    provider: str
    model: str
    latency_ms: int = 0
    attempts: list[dict[str, Any]] = field(default_factory=list)

    @property
    def is_fallback(self) -> bool:
        return self.data is None


def wrap_untrusted(label: str, text: str) -> str:
    """Delimit untrusted content so instructions inside it are treated as data."""
    safe = (text or "").replace("</untrusted", "<\\/untrusted")
    return f'<untrusted_{label}>\n{safe}\n</untrusted_{label}>'


def _parse_json(raw: str) -> dict[str, Any]:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw[raw.find("{"):]
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    obj = json.loads(raw[start : end + 1])
    if not isinstance(obj, dict):
        raise ValueError("response is not a JSON object")
    return obj


def _validate(obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Minimal structural validation (required keys, enum, number bounds, types)."""
    props: dict[str, Any] = schema.get("properties", {})
    for key in schema.get("required", []):
        if key not in obj:
            raise ValueError(f"missing key: {key}")
    clean: dict[str, Any] = {}
    for key, spec in props.items():
        if key not in obj:
            continue
        val = obj[key]
        t = spec.get("type")
        if t == "string":
            if val is None:
                continue
            val = str(val)[: spec.get("maxLength", 4000)]
            if "enum" in spec and val not in spec["enum"]:
                raise ValueError(f"{key}={val!r} not in enum")
        elif t == "number":
            val = float(val)
            val = max(spec.get("minimum", val), min(spec.get("maximum", val), val))
        elif t == "array":
            if not isinstance(val, list):
                raise ValueError(f"{key} must be a list")
            val = [str(x)[:500] for x in val][: spec.get("maxItems", 20)]
        elif t == "boolean":
            val = bool(val)
        clean[key] = val
    return clean  # unknown keys are dropped on purpose


def _call_groq(system: str, user: str, schema: dict[str, Any]) -> tuple[str, str]:
    from groq import Groq

    s = get_settings()
    client = Groq(api_key=s.groq_api_key, timeout=s.llm_timeout_seconds, max_retries=1)
    resp = client.chat.completions.create(
        model=s.groq_model,
        messages=[
            {"role": "system", "content": system + "\n\nRespond with a single JSON object matching this JSON schema:\n" + json.dumps(schema)},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=1500,
    )
    return resp.choices[0].message.content or "", s.groq_model


def _call_gemini(system: str, user: str, schema: dict[str, Any]) -> tuple[str, str]:
    from google import genai
    from google.genai import types

    s = get_settings()
    client = genai.Client(
        api_key=s.gemini_api_key,
        http_options=types.HttpOptions(timeout=int(s.llm_timeout_seconds * 1000)),
    )
    resp = client.models.generate_content(
        model=s.gemini_model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=0,
            max_output_tokens=1500,
        ),
    )
    return resp.text or "", s.gemini_model


PROVIDERS = (
    ("groq", "groq_enabled", _call_groq),
    ("gemini", "gemini_enabled", _call_gemini),
)


def complete_json(system: str, user: str, schema: dict[str, Any]) -> LLMResult:
    """Try each configured provider in order; return validated JSON or a fallback marker."""
    s = get_settings()
    attempts: list[dict[str, Any]] = []
    for name, flag, fn in PROVIDERS:
        if not getattr(s, flag):
            attempts.append({"provider": name, "status": "skipped", "reason": "no API key configured"})
            continue
        t0 = time.perf_counter()
        try:
            raw, model = fn(system, user, schema)
            data = _validate(_parse_json(raw), schema)
            ms = int((time.perf_counter() - t0) * 1000)
            attempts.append({"provider": name, "status": "ok", "latency_ms": ms})
            return LLMResult(data=data, provider=name, model=model, latency_ms=ms, attempts=attempts)
        except Exception as exc:  # provider/network/validation errors all fall through
            ms = int((time.perf_counter() - t0) * 1000)
            # Log the error class only — never the prompt (it contains citizen text).
            log.warning("LLM provider %s failed: %s", name, type(exc).__name__)
            attempts.append({"provider": name, "status": "error", "error": type(exc).__name__, "latency_ms": ms})
    return LLMResult(data=None, provider=FALLBACK_PROVIDER, model=FALLBACK_MODEL, attempts=attempts)


def provider_status() -> dict[str, Any]:
    s = get_settings()
    chain = [p for p, flag, _ in PROVIDERS if getattr(s, flag)]
    return {
        "mode": "llm" if chain else "fallback",
        "chain": chain + [FALLBACK_PROVIDER],
        "groq": {"configured": s.groq_enabled, "model": s.groq_model},
        "gemini": {"configured": s.gemini_enabled, "model": s.gemini_model},
    }
