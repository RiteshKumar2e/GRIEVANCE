"""Whisper speech-to-text (faster-whisper, runs locally). Optional dependency."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from app.core.config import get_settings

log = logging.getLogger("grievance.stt")

SUPPORTED_LANGS = {"hi", "mr", "en"}

_lock = threading.Lock()
_model = None
_failed = False


class STTUnavailable(RuntimeError):
    pass


@dataclass
class Transcript:
    text: str
    language: str
    confidence: float
    provider: str


def _load():
    global _model, _failed
    s = get_settings()
    if s.stt_provider == "disabled":
        raise STTUnavailable("Speech-to-text is disabled on this server.")
    if _model is not None:
        return _model
    if _failed:
        raise STTUnavailable("Whisper is not installed on this server. Install backend/requirements-ml.txt.")
    with _lock:
        if _model is None and not _failed:
            try:
                from faster_whisper import WhisperModel

                _model = WhisperModel(s.whisper_model, device="cpu", compute_type="int8")
            except Exception as exc:
                log.warning("Whisper unavailable: %s", type(exc).__name__)
                _failed = True
                raise STTUnavailable(
                    "Whisper is not installed on this server. Install backend/requirements-ml.txt."
                ) from exc
    return _model


def is_available() -> bool:
    """Cheap check (does not load the model)."""
    import importlib.util

    if get_settings().stt_provider == "disabled" or _failed:
        return False
    return _model is not None or importlib.util.find_spec("faster_whisper") is not None


def transcribe(path: str, language_hint: str | None = None) -> Transcript:
    model = _load()
    lang = language_hint if language_hint in SUPPORTED_LANGS else None
    segments, info = model.transcribe(path, language=lang, beam_size=5, vad_filter=True)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    detected = info.language if info.language in SUPPORTED_LANGS else (lang or "en")
    return Transcript(
        text=text,
        language=detected,
        confidence=float(getattr(info, "language_probability", 0.0) or 0.0),
        provider=f"faster-whisper:{get_settings().whisper_model}",
    )
