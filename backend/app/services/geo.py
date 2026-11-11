"""Ward gazetteer used for location extraction and approximate coordinates.

Reads `data/raw/wards.csv` (official, if supplied) or falls back to `data/synthetic/wards.csv`.
Columns: ward, locality, latitude, longitude.
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

from app.core.config import BACKEND_DIR

DATA = BACKEND_DIR / "data"


@lru_cache
def load_wards() -> list[dict]:
    for p in (DATA / "raw" / "wards.csv", DATA / "synthetic" / "wards.csv"):
        if Path(p).exists():
            with open(p, encoding="utf-8") as fh:
                rows = list(csv.DictReader(fh))
            return [{"ward": r["ward"], "locality": r["locality"], "latitude": float(r["latitude"]),
                     "longitude": float(r["longitude"]), "source": "OFFICIAL" if "raw" in str(p) else "SYNTHETIC"} for r in rows]
    return []


def gazetteer() -> list[tuple[str, str]]:
    return [(w["ward"], w["locality"]) for w in load_wards()]


def centroid(ward: str | None) -> tuple[float | None, float | None]:
    for w in load_wards():
        if w["ward"] == ward:
            return w["latitude"], w["longitude"]
    return None, None
