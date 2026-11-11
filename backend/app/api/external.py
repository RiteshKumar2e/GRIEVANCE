"""External public datasets: provenance, BBMP statistics and record explorer, data.gov.in rows.

Staff-only. These endpoints never touch the HackFusion datasets or live grievances."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import require_officer
from app.core.time import as_aware
from app.db.session import get_db
from app.models import ExternalDataset, ExternalGrievanceRecord, OfficialDatasetRow, User
from app.services import external_data as ext

router = APIRouter(prefix="/external", tags=["external datasets"])


def _iso(dt):
    return as_aware(dt).isoformat() if dt else None


@router.get("/datasets")
def datasets(_: User = Depends(require_officer), db: Session = Depends(get_db)):
    """Provenance of every external dataset: source, licence, checksum, coverage, quality and transformations."""
    rows = db.scalars(select(ExternalDataset).order_by(ExternalDataset.id)).all()
    known = {d.key for d in rows}
    items = [
        {"key": d.key, "title": d.title, "publisher": d.publisher, "kind": d.kind, "source_url": d.source_url,
         "download_url": d.download_url, "licence": d.licence, "licence_url": d.licence_url, "attribution": d.attribution,
         "file_name": d.file_name, "sha256": d.sha256, "downloaded_at": _iso(d.downloaded_at), "imported_at": _iso(d.imported_at),
         "rows_in_source": d.rows_in_source, "rows_imported": d.rows_imported, "coverage_start": _iso(d.coverage_start),
         "coverage_end": _iso(d.coverage_end), "columns": d.columns, "unavailable_fields": d.unavailable_fields,
         "transformations": d.transformations, "quality": {k: v for k, v in (d.quality or {}).items() if k != "summary"},
         "status": d.status, "notes": d.notes}
        for d in rows
    ]
    for key, src in ext.SOURCES.items():  # sources not yet fetched still appear, honestly marked
        if key not in known:
            items.append({"key": key, "title": src["title"], "publisher": src["publisher"], "kind": src["kind"],
                          "source_url": src["source_url"], "licence": src["licence"], "licence_url": src.get("licence_url"),
                          "attribution": src["attribution"], "status": "not_fetched", "rows_imported": 0,
                          "notes": "Not downloaded yet. Run: python -m app.cli external fetch" if key.startswith("bbmp")
                          else ext.ogd_status(get_settings().data_gov_in_api_key).get("requirement", "")})
    return {"items": items, "ogd": ext.ogd_status(get_settings().data_gov_in_api_key),
            "cpgrams_individual_records": ("Individual CPGRAMS grievances are not public. They are available only to "
                                           "authorised officers through pgportal.gov.in, so they are not used here.")}


@router.get("/bbmp/summary")
def bbmp_summary(_: User = Depends(require_officer), db: Session = Depends(get_db)):
    s = ext.bbmp_summary(db)
    if s is None:
        raise HTTPException(404, "BBMP data has not been imported. Run: python -m app.cli external fetch && python -m app.cli external import")
    return s


@router.get("/bbmp/records")
def bbmp_records(
    q: str | None = Query(default=None, max_length=80),
    category: str | None = None,
    ward: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1, le=1000),
    size: int = Query(default=25, ge=5, le=100),
    _: User = Depends(require_officer),
    db: Session = Depends(get_db),
):
    R = ExternalGrievanceRecord
    stmt = select(R).join(ExternalDataset, ExternalDataset.id == R.dataset_id).where(ExternalDataset.key == "bbmp_sahaaya_vonter")
    if category:
        stmt = stmt.where(R.category == category)
    if ward:
        stmt = stmt.where(R.ward == ward)
    if status:
        stmt = stmt.where(R.source_status == status)
    if q and q.strip().isdigit():
        stmt = stmt.where(R.source_record_id == q.strip())  # exact, uses the (dataset_id, source_record_id) index
    elif q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(R.sub_category.ilike(like), R.staff_remarks.ilike(like), R.ward.ilike(like)))
    # Count at most CAP matches so a broad search over 1.2M rows stays fast; walk the filed_at index newest first.
    CAP = 1000
    total = db.scalar(select(func.count()).select_from(stmt.limit(CAP + 1).subquery())) or 0
    rows = db.scalars(stmt.order_by(R.filed_at.desc()).offset((page - 1) * size).limit(size)).all()
    return {"total": min(total, CAP), "total_capped": total > CAP, "page": page, "size": size, "items": [
        {"source_record_id": r.source_record_id, "category": r.category, "sub_category": r.sub_category,
         "filed_at": _iso(r.filed_at), "date_valid": r.date_valid, "zone": r.zone, "ward": r.ward, "channel": r.channel,
         "source_status": r.source_status, "staff_remarks": r.staff_remarks, "citizen_rating": r.citizen_rating}
        for r in rows]}


@router.get("/ogd/{key}")
def ogd_rows(key: str, limit: int = Query(default=200, le=2000), _: User = Depends(require_officer), db: Session = Depends(get_db)):
    ds = db.scalar(select(ExternalDataset).where(ExternalDataset.key == key))
    if ds is None or not key.startswith("ogd_"):
        raise HTTPException(404, "Unknown dataset")
    rows = db.scalars(select(OfficialDatasetRow).where(OfficialDatasetRow.dataset_id == ds.id).limit(limit)).all()
    return {"key": key, "status": ds.status, "columns": ds.columns, "notes": ds.notes, "rows": [r.row for r in rows]}
