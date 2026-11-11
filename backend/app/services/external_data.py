"""External public grievance datasets: download, validate, minimise, import, summarise.

Sources (see backend/data/external/PROVENANCE.md):
  * BBMP Sahaaya 2.0 citizen grievances, compiled by Vonter (GitHub), ODbL-1.0        -> imported
  * BBMP Grievances Data on OpenCity (2025 file), "Other (Public Domain)"              -> verification only
  * data.gov.in CPGRAM catalogues (Government Open Data License - India)              -> need an OGD API key

Rules applied here:
  * Kept in separate tables; never merged with the HackFusion Category Master / Mock History / Directory.
  * No invented values: absent fields are stored as NULL and listed as unavailable.
  * Data minimisation: staff names and designations are dropped; staff remarks are PII-redacted.
  * The source's own status is stored verbatim (it includes "Rejected", which GRIEVANCE itself never uses).
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import httpx
from sqlalchemy import String, delete, func, insert, select
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.core.privacy import redact_text
from app.core.time import utcnow
from app.models import ExternalDataset, ExternalGrievanceRecord, OfficialDatasetRow

log = logging.getLogger("grievance.external")
EXTERNAL_DIR = BACKEND_DIR / "data" / "external"
BBMP_RAW = EXTERNAL_DIR / "bbmp" / "raw"

SOURCES: dict[str, dict[str, Any]] = {
    "bbmp_sahaaya_vonter": {
        "title": "BBMP citizen grievances (Sahaaya 2.0 portal)",
        "publisher": "Compiled by Vonter from the Bengaluru Smart City Limited website; contents (c) BBMP",
        "kind": "individual_records",
        "source_url": "https://github.com/Vonter/bbmp-citizen-grievances",
        "download_url": "https://raw.githubusercontent.com/Vonter/bbmp-citizen-grievances/main/data/citizen-grievances.csv.gz",
        "file_name": "citizen-grievances.csv.gz",
        "licence": "Open Database License (ODbL) v1.0",
        "licence_url": "https://opendatacommons.org/licenses/odbl/1-0/",
        "attribution": "Contains information from bbmp-citizen-grievances (github.com/Vonter/bbmp-citizen-grievances), "
                       "made available under the ODbL v1.0. Some individual contents are under copyright by BBMP.",
    },
    "bbmp_opencity_2025": {
        "title": "BBMP Grievances Data, 2025 file (OpenCity)",
        "publisher": "Bruhat Bengaluru Mahanagara Palike (BBMP) via OpenCity",
        "kind": "individual_records",
        "source_url": "https://www.data.opencity.in/dataset/bbmp-grievances-data",
        "download_url": "https://data.opencity.in/dataset/54344a76-a37a-4d05-961c-df9bac5494ad/resource/1342a93b-9a61-4766-9c34-c8357b7926c2/download/b0d6e9ff-5eef-48bf-ba86-985dbe8112d1.csv",
        "file_name": "opencity-bbmp-grievances-2025.csv",
        "licence": "Other (Public Domain), as stated on the OpenCity dataset page",
        "licence_url": "https://www.data.opencity.in/dataset/bbmp-grievances-data",
        "attribution": "BBMP Grievances Data, OpenCity (data.opencity.in).",
    },
    "ogd_cpgram_nodal_officers": {
        "title": "CPGRAM Nodal Public Grievance Officers Details",
        "publisher": "Department of Administrative Reforms and Public Grievances (DARPG), via data.gov.in",
        "kind": "directory",
        "source_url": "https://data.gov.in/catalog/cpgram-nodal-public-grievance-officers-details",
        "catalog_id": "055eeced-b527-4106-9866-a89a3ff68f35",
        "licence": "Government Open Data License - India",
        "licence_url": "https://data.gov.in/government-open-data-license-india",
        "attribution": "Source: Open Government Data Platform India (data.gov.in), DARPG.",
    },
    "ogd_cpgram_monthly_receipts_disposals": {
        "title": "Monthly Department-wise public grievance receipts and disposals",
        "publisher": "Department of Administrative Reforms and Public Grievances (DARPG), via data.gov.in",
        "kind": "aggregate_statistics",
        "source_url": "https://data.gov.in/catalog/monthly-department-wise-public-grievance-receipts-and-disposals",
        "catalog_id": "9891bb4a-7f02-444a-b6bc-2691589d9a64",
        "licence": "Government Open Data License - India",
        "licence_url": "https://data.gov.in/government-open-data-license-india",
        "attribution": "Source: Open Government Data Platform India (data.gov.in), DARPG.",
    },
}

# Fields GRIEVANCE's canonical schema has that the BBMP release does not contain.
BBMP_UNAVAILABLE = [
    "complaint text written by the citizen",
    "resolution / closure timestamp (so resolution time and SLA outcomes cannot be computed)",
    "SLA target",
    "geo-coordinates",
    "department responsible (only BBMP's own category)",
    "citizen identity (correctly absent)",
]
BBMP_TRANSFORMS = [
    "Dropped 'Staff Name' and 'Staff Designation' (personal data of staff; not needed).",
    "Redacted phone numbers (mobile and landline), e-mail addresses, numbers of 6 or more digits (e.g. property ePIDs) "
    "and honorific-prefixed personal names in 'Staff Remarks'.",
    "Collapsed repeated whitespace in category, sub-category, zone, ward and channel names.",
    "Parsed 'Grievance Date' as Asia/Kolkata local time and stored it in UTC; dates before 2015-01-01 or after the "
    "download date are kept as NULL with date_valid = false (no value is guessed).",
    "'Rating' kept only when it is an integer 1 to 5; otherwise NULL.",
    "'Grievance Status' stored verbatim as source_status; it is not mapped to GRIEVANCE statuses.",
]
IST = timezone.utc  # replaced below to avoid a hard dependency on zoneinfo data on Windows
try:  # pragma: no cover - depends on platform tz data
    from zoneinfo import ZoneInfo

    IST = ZoneInfo("Asia/Kolkata")
except Exception:  # noqa: BLE001
    from datetime import timedelta

    IST = timezone(timedelta(hours=5, minutes=30))

_WS = re.compile(r"\s+")
_HONORIFIC_NAME = re.compile(r"\b(?:Mr|Mrs|Ms|Miss|Sri|Shri|Smt|Dr)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?")
_LANDLINE = re.compile(r"\b0\d{2,4}[\s-]?\d{6,8}\b")
_LONG_NUMBER = re.compile(r"\b\d{6,}\b")


def redact_remarks(text: str) -> str:
    """Stronger redaction for free-text staff remarks: phones, e-mails, ID numbers, landlines,
    long identifiers (e.g. property ePIDs) and honorific-prefixed personal names."""
    out = redact_text(text)
    out = _LANDLINE.sub("[phone]", out)
    out = _LONG_NUMBER.sub("[number]", out)
    return _HONORIFIC_NAME.sub("[name]", out)
_DATE_MIN = datetime(2015, 1, 1, tzinfo=timezone.utc)


def _clean(v: str | None, limit: int) -> str | None:
    if v is None:
        return None
    v = _WS.sub(" ", v).strip()
    if not v or v.lower() in {"null", "none", "nan", "na"}:
        return None
    return v[:limit]


def _parse_date(raw: str | None, upper: datetime) -> tuple[datetime | None, bool]:
    if not raw:
        return None, False
    try:
        dt = datetime.strptime(raw.strip()[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST).astimezone(timezone.utc)
    except ValueError:
        return None, False
    if dt < _DATE_MIN or dt > upper:
        return None, False
    return dt, True


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(key: str, dest_dir: Path = BBMP_RAW, timeout: float = 600.0) -> Path:
    """Download one public file (no authentication) and return its path."""
    src = SOURCES[key]
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src["file_name"]
    tmp = dest.with_suffix(dest.suffix + ".part")
    with httpx.stream("GET", src["download_url"], timeout=timeout, follow_redirects=True) as r:
        r.raise_for_status()
        with open(tmp, "wb") as fh:
            for chunk in r.iter_bytes(1 << 20):
                fh.write(chunk)
    tmp.replace(dest)
    return dest


def ensure_dataset(db: Session, key: str) -> ExternalDataset:
    ds = db.scalar(select(ExternalDataset).where(ExternalDataset.key == key))
    src = SOURCES[key]
    if ds is None:
        ds = ExternalDataset(key=key)
        db.add(ds)
    for f in ("title", "publisher", "kind", "source_url", "licence", "licence_url", "attribution"):
        setattr(ds, f, src.get(f) or "")
    ds.download_url = src.get("download_url")
    ds.file_name = src.get("file_name")
    db.flush()
    return ds


def _iter_rows(path: Path) -> Iterator[dict[str, str]]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as fh:  # type: ignore[operator]
        yield from csv.DictReader(fh)


def import_bbmp(db: Session, path: Path | None = None, *, limit: int | None = None, batch: int = 5000,
                downloaded_at: datetime | None = None, replace: bool = False) -> dict[str, Any]:
    """Validate, minimise and import the BBMP release. Idempotent: existing record IDs are skipped,
    unless replace=True, which deletes this dataset's records first and re-imports from the file."""
    path = path or (BBMP_RAW / SOURCES["bbmp_sahaaya_vonter"]["file_name"])
    if not path.exists():
        raise FileNotFoundError(f"{path} not found. Run: python -m app.cli external fetch")
    ds = ensure_dataset(db, "bbmp_sahaaya_vonter")
    if replace:
        db.execute(delete(ExternalGrievanceRecord).where(ExternalGrievanceRecord.dataset_id == ds.id))
        db.commit()
    upper = downloaded_at or datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    existing = set(db.scalars(select(ExternalGrievanceRecord.source_record_id).where(ExternalGrievanceRecord.dataset_id == ds.id)))
    q = {"rows_read": 0, "imported": 0, "skipped_existing": 0, "skipped_duplicate_id_in_file": 0, "skipped_missing_id": 0,
         "invalid_dates": 0, "remarks_redacted": 0, "missing": {}, "columns": []}
    seen: set[str] = set()
    buf: list[dict[str, Any]] = []
    cmin = cmax = None

    def flush():
        if buf:
            db.execute(insert(ExternalGrievanceRecord), buf)
            buf.clear()

    for i, row in enumerate(_iter_rows(path)):
        if i == 0:
            q["columns"] = list(row.keys())
        if limit is not None and q["rows_read"] >= limit:
            break
        q["rows_read"] += 1
        for col, val in row.items():
            if not (val or "").strip() or (val or "").strip().lower() == "null":
                q["missing"][col] = q["missing"].get(col, 0) + 1
        rid = (row.get("Complaint ID") or "").strip()
        if not rid:
            q["skipped_missing_id"] += 1
            continue
        if rid in existing:
            q["skipped_existing"] += 1
            continue
        if rid in seen:
            q["skipped_duplicate_id_in_file"] += 1
            continue
        seen.add(rid)
        filed, ok = _parse_date(row.get("Grievance Date"), upper)
        if not ok:
            q["invalid_dates"] += 1
        else:
            cmin = filed if cmin is None or filed < cmin else cmin
            cmax = filed if cmax is None or filed > cmax else cmax
        remarks_raw = _clean(row.get("Staff Remarks"), 2000)
        remarks = redact_remarks(remarks_raw) if remarks_raw else None
        if remarks_raw and remarks != remarks_raw:
            q["remarks_redacted"] += 1
        rating = (row.get("Rating") or "").strip()
        buf.append({
            "dataset_id": ds.id, "source_record_id": rid[:40],
            "category": _clean(row.get("Category"), 120) or "Unspecified",
            "sub_category": _clean(row.get("Sub Category"), 200),
            "filed_at": filed, "date_valid": ok,
            "zone": _clean(row.get("Zone Name"), 80), "ward": _clean(row.get("Ward Name"), 120),
            "channel": _clean(row.get("Grievance Mode"), 80),
            "source_status": _clean(row.get("Grievance Status"), 40),
            "staff_remarks": remarks,
            "citizen_rating": int(rating) if rating.isdigit() and 1 <= int(rating) <= 5 else None,
        })
        q["imported"] += 1
        if len(buf) >= batch:
            flush()
    flush()

    total = db.scalar(select(func.count()).select_from(ExternalGrievanceRecord).where(ExternalGrievanceRecord.dataset_id == ds.id)) or 0
    ds.rows_in_source = max(ds.rows_in_source or 0, q["rows_read"]) if limit is None else ds.rows_in_source or q["rows_read"]
    ds.rows_imported = total
    ds.columns = q["columns"]
    ds.unavailable_fields = BBMP_UNAVAILABLE
    ds.transformations = BBMP_TRANSFORMS + ([f"Import limited to the first {limit} rows."] if limit else [])
    if cmin:
        ds.coverage_start = cmin if ds.coverage_start is None else min(ds.coverage_start.replace(tzinfo=ds.coverage_start.tzinfo or timezone.utc), cmin)
    if cmax:
        ds.coverage_end = cmax if ds.coverage_end is None else max(ds.coverage_end.replace(tzinfo=ds.coverage_end.tzinfo or timezone.utc), cmax)
    ds.sha256 = sha256_of(path)
    ds.downloaded_at = upper
    ds.imported_at = utcnow()
    ds.quality = {k: v for k, v in q.items() if k != "columns"}
    ds.status = "imported"
    ds.notes = ("Individual grievance records from a municipal portal. No citizen-written complaint text is included, "
                "so the records are used for statistics and as reference context, not for text-based RAG or duplicate detection.")
    db.commit()
    _SUMMARY_CACHE.clear()
    bbmp_summary(db)  # precompute and persist the statistics for this import
    return {"dataset": ds.key, **{k: v for k, v in ds.quality.items() if k != "summary"}, "total_in_db": total}


def verify_against_opencity(db: Session, path: Path | None = None) -> dict[str, Any]:
    """Cross-check the imported BBMP records against the independent OpenCity 2025 snapshot (not imported)."""
    path = path or (BBMP_RAW / SOURCES["bbmp_opencity_2025"]["file_name"])
    ds = ensure_dataset(db, "bbmp_opencity_2025")
    if not path.exists():
        ds.status, ds.notes = "registered", "File not downloaded."
        db.commit()
        return {"available": False}
    main = db.scalar(select(ExternalDataset).where(ExternalDataset.key == "bbmp_sahaaya_vonter"))
    rows = list(_iter_rows(path))
    ids = [r.get("Complaint ID", "").strip() for r in rows]
    known: dict[str, tuple[str | None, str | None]] = {}
    if main:
        for chunk_start in range(0, len(ids), 900):
            chunk = ids[chunk_start:chunk_start + 900]
            for rid, cat, st in db.execute(select(ExternalGrievanceRecord.source_record_id, ExternalGrievanceRecord.category,
                                                  ExternalGrievanceRecord.source_status)
                                           .where(ExternalGrievanceRecord.dataset_id == main.id, ExternalGrievanceRecord.source_record_id.in_(chunk))):
                known[rid] = (cat, st)
    shared = [r for r in rows if r.get("Complaint ID", "").strip() in known]
    same_cat = sum(1 for r in shared if _clean(r.get("Category"), 120) == known[r["Complaint ID"].strip()][0])
    same_status = sum(1 for r in shared if _clean(r.get("Grievance Status"), 40) == known[r["Complaint ID"].strip()][1])
    result = {"rows_in_file": len(rows), "ids_found_in_imported_dataset": len(shared),
              "same_category": same_cat, "same_status": same_status,
              "columns": list(rows[0].keys()) if rows else []}
    ds.rows_in_source, ds.rows_imported, ds.columns = len(rows), 0, result["columns"]
    ds.sha256, ds.downloaded_at = sha256_of(path), datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    ds.quality = result
    ds.status = "verification_only"
    ds.unavailable_fields = BBMP_UNAVAILABLE + ["zone, channel, rating (columns not present in this file)"]
    ds.transformations = ["Not imported: every Complaint ID also appears in the larger GitHub release, so importing would double count."]
    ds.notes = ("Used as an independent check of the imported release. Status differences reflect the different dates "
                "on which the two snapshots were taken.")
    db.commit()
    return result


# ------------------------------------------------------------------ data.gov.in (OGD) — needs a personal API key
OGD_API = "https://api.data.gov.in"


def ogd_status(api_key: str | None) -> dict[str, Any]:
    if not api_key:
        return {"configured": False,
                "requirement": "data.gov.in's API returns 'Authorization field missing' without a key. Register free at "
                               "https://data.gov.in, generate an API key under My Account, set DATA_GOV_IN_API_KEY in "
                               "backend/.env and run: python -m app.cli external fetch-ogd"}
    return {"configured": True}


def fetch_ogd(db: Session, api_key: str, keys: tuple[str, ...] = ("ogd_cpgram_nodal_officers", "ogd_cpgram_monthly_receipts_disposals"),
              resource_ids: dict[str, list[str]] | None = None, max_rows: int = 20000) -> dict[str, Any]:
    """Fetch OGD resources with the user's own API key and store the rows verbatim (with field metadata).

    Resource IDs are discovered from the catalogue API unless given explicitly. Personal contact fields
    (phone, mobile, e-mail, fax) are removed from directory rows before storage."""
    out: dict[str, Any] = {}
    for key in keys:
        src = SOURCES[key]
        ds = ensure_dataset(db, key)
        try:
            ids = (resource_ids or {}).get(key) or _ogd_resource_ids(src["catalog_id"], api_key)
            if not ids:
                raise RuntimeError("no resources listed for this catalogue")
            db.execute(delete(OfficialDatasetRow).where(OfficialDatasetRow.dataset_id == ds.id))
            n, fields = 0, []
            for rid in ids:
                offset = 0
                while offset < max_rows:
                    r = httpx.get(f"{OGD_API}/resource/{rid}", params={"api-key": api_key, "format": "json", "offset": offset, "limit": 500}, timeout=60)
                    r.raise_for_status()
                    data = r.json()
                    fields = data.get("field") or fields
                    recs = data.get("records") or []
                    for rec in recs:
                        if src["kind"] == "directory":
                            rec = {k: v for k, v in rec.items() if not re.search(r"phone|mobile|e[-_ ]?mail|fax", k, re.I)}
                        db.add(OfficialDatasetRow(dataset_id=ds.id, resource_id=rid, row=rec))
                        n += 1
                    if len(recs) < 500:
                        break
                    offset += 500
            ds.rows_imported = ds.rows_in_source = n
            ds.columns = [f.get("name") or f.get("id") for f in fields] if fields else []
            ds.transformations = ["Rows stored verbatim as JSON with their OGD field list."] + (
                ["Removed phone, mobile, e-mail and fax fields from the directory (data minimisation)."] if src["kind"] == "directory" else [])
            ds.downloaded_at = ds.imported_at = utcnow()
            ds.status, ds.notes = "imported", f"Resources: {', '.join(ids)}"
            out[key] = {"rows": n, "resources": ids}
        except Exception as exc:  # network, auth, schema
            ds.status, ds.notes = "failed", f"{type(exc).__name__}: {str(exc)[:300]}"
            out[key] = {"error": ds.notes}
        db.commit()
    return out


def _ogd_resource_ids(catalog_id: str, api_key: str) -> list[str]:
    r = httpx.get(f"{OGD_API}/catalog/{catalog_id}", params={"api-key": api_key, "format": "json", "limit": 100}, timeout=60)
    r.raise_for_status()
    data = r.json()
    ids = []
    for rec in data.get("records") or []:
        for k in ("index_name", "resource_id", "id"):
            v = rec.get(k)
            if isinstance(v, str) and re.fullmatch(r"[0-9a-f-]{36}", v):
                ids.append(v)
                break
    return ids


def register_ogd_placeholders(db: Session, api_key: str | None) -> None:
    for key in ("ogd_cpgram_nodal_officers", "ogd_cpgram_monthly_receipts_disposals"):
        ds = ensure_dataset(db, key)
        if ds.status != "imported":
            ds.status = "needs_credentials" if not api_key else ds.status
            ds.notes = ds.notes or ogd_status(api_key).get("requirement", "")
    db.commit()


# ------------------------------------------------------------------ summaries (cached per import)
_SUMMARY_CACHE: dict[str, Any] = {}


def bbmp_summary(db: Session) -> dict[str, Any] | None:
    ds = db.scalar(select(ExternalDataset).where(ExternalDataset.key == "bbmp_sahaaya_vonter", ExternalDataset.status == "imported"))
    if ds is None:
        return None
    cache_key = f"{ds.id}:{ds.imported_at}"
    if cache_key in _SUMMARY_CACHE:
        return _SUMMARY_CACHE[cache_key]
    stored = (ds.quality or {}).get("summary")
    if stored and stored.get("_imported_at") == str(ds.imported_at):
        _SUMMARY_CACHE[cache_key] = stored
        return stored
    R = ExternalGrievanceRecord
    base = select(func.count()).select_from(R).where(R.dataset_id == ds.id)

    def top(col, n=12, where=None):
        q = select(col, func.count()).where(R.dataset_id == ds.id)
        if where is not None:
            q = q.where(where)
        return [{"name": k or "Unspecified", "count": int(c)} for k, c in
                db.execute(q.group_by(col).order_by(func.count().desc()).limit(n)).all()]

    monthly = [{"month": m, "count": int(c)} for m, c in db.execute(
        select(func.substr(func.cast(R.filed_at, String()), 1, 7).label("m"), func.count())
        .where(R.dataset_id == ds.id, R.filed_at.is_not(None)).group_by("m").order_by("m")).all() if m]
    result = {
        "dataset": {"key": ds.key, "title": ds.title, "licence": ds.licence, "source_url": ds.source_url,
                    "coverage_start": ds.coverage_start.isoformat() if ds.coverage_start else None,
                    "coverage_end": ds.coverage_end.isoformat() if ds.coverage_end else None},
        "total_records": int(db.scalar(base) or 0),
        "invalid_dates": int(db.scalar(base.where(R.date_valid.is_(False))) or 0),
        "with_staff_remarks": int(db.scalar(base.where(R.staff_remarks.is_not(None))) or 0),
        "with_rating": int(db.scalar(base.where(R.citizen_rating.is_not(None))) or 0),
        "monthly": monthly,
        "categories": top(R.category, 15),
        "sub_categories": top(R.sub_category, 15),
        "statuses": top(R.source_status, 12),
        "channels": top(R.channel, 10),
        "zones": top(R.zone, 16),
        "wards": top(R.ward, 15),
        "ratings": sorted(top(R.citizen_rating, 6, R.citizen_rating.is_not(None)), key=lambda x: str(x["name"])),
        # Full distinct lists (small) so the record explorer can resolve search terms without scanning rows.
        "all_sub_categories": sorted(v for (v,) in db.execute(select(R.sub_category).where(R.dataset_id == ds.id).distinct()) if v),
        "all_wards": sorted(v for (v,) in db.execute(select(R.ward).where(R.dataset_id == ds.id).distinct()) if v),
    }
    result["_imported_at"] = str(ds.imported_at)
    ds.quality = {**(ds.quality or {}), "summary": result}  # persisted: computed once per import
    db.commit()
    _SUMMARY_CACHE.clear()
    _SUMMARY_CACHE[cache_key] = result
    return result

