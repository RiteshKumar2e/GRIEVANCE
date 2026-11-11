"""Local multilingual embeddings.

Primary: sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2` (384-d, Hindi/Marathi/English,
runs locally, no API calls). Fallback: a deterministic character n-gram hashing embedder (384-d)
so retrieval and duplicate detection keep working without the model download.
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
import unicodedata

import numpy as np

from app.core.config import get_settings

log = logging.getLogger("grievance.embeddings")

_lock = threading.Lock()
_model = None
_model_failed = False


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFC", text or "").lower()
    text = re.sub(r"[^\w\sऀ-ॿ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _hash_embed(text: str, dim: int) -> list[float]:
    vec = np.zeros(dim, dtype=np.float32)
    norm = _normalise(text)
    tokens = norm.split()
    feats: list[str] = [f"w:{t}" for t in tokens]
    feats += [f"b:{a}_{b}" for a, b in zip(tokens, tokens[1:])]
    for tok in tokens:
        padded = f" {tok} "
        for n in (3, 4):
            feats += [f"c{n}:{padded[i:i+n]}" for i in range(max(1, len(padded) - n + 1))]
    for f in feats:
        h = hashlib.blake2b(f.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(h[:4], "little") % dim
        sign = 1.0 if h[4] & 1 else -1.0
        weight = 2.0 if f.startswith("w:") else 1.0
        vec[idx] += sign * weight
    n = np.linalg.norm(vec)
    return (vec / n).tolist() if n > 0 else vec.tolist()


def _load_model():
    global _model, _model_failed
    if _model is not None or _model_failed:
        return _model
    with _lock:
        if _model is not None or _model_failed:
            return _model
        try:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(get_settings().embedding_model)
            log.info("Loaded embedding model %s", get_settings().embedding_model)
        except Exception as exc:  # ImportError, download failure, …
            log.warning("Embedding model unavailable (%s); using hashing fallback", type(exc).__name__)
            _model_failed = True
    return _model


def provider_name() -> str:
    s = get_settings()
    if s.embedding_provider == "hashing":
        return "hashing-ngram-384"
    if s.embedding_provider in ("auto", "sentence-transformers") and _load_model() is not None:
        return s.embedding_model
    return "hashing-ngram-384"


def embed_texts(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    dim = s.embedding_dim
    if s.embedding_provider != "hashing":
        model = _load_model()
        if model is not None:
            arr = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
            return [list(map(float, row)) for row in arr]
    return [_hash_embed(t, dim) for t in texts]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
