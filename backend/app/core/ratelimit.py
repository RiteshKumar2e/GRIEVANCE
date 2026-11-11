"""Tiny in-memory fixed-window rate limiter for auth and intake endpoints (single-process)."""
from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self.enabled = True

    def check(self, request: Request, scope: str, *, limit: int, window: int, key: str | None = None) -> None:
        if not self.enabled:
            return
        ident = key or (request.client.host if request.client else "unknown")
        k = f"{scope}:{ident}"
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[k] if now - t < window]
            if len(hits) >= limit:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please try again later.")
            hits.append(now)
            self._hits[k] = hits

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
