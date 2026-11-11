"""Reusable CSV / XLSX importer for the Category Master, Department Directory, Officers and
Grievance History. Column names are mapped through `data/schemas/<kind>.json` so official files
with different headers can be imported without code changes.

Rules
* Every imported row is tagged with its `data_source` (SYNTHETIC or OFFICIAL).
* A row never silently overwrites a record from a *different* source: it is skipped and reported,
  unless `replace_other_sources=True` is passed explicitly (and that is recorded in the import log).
* `dry_run=True` validates and reports without writing.
"""
from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.core.security import hash_password
from app.models import DatasetImport, Department, Grievance, GrievanceCategory, Officer, User
from app.models.enums import DataSource, GrievanceStatus, Role

SCHEMA_DIR = BACKEND_DIR / "data" / "schemas"
KINDS = ("departments", "categories", "officers", "grievance_history")
TRUE = {"1", "true", "yes", "y", "t"}


@dataclass
class ImportReport:
    kind: str
    total: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict[str, Any]] = field(default_factory=list)
    unmapped_columns: list[str] = field(default_factory=list)
    preview: list[dict[str, Any]] = field(default_factory=list)


def load_schema(kind: str) -> dict[str, Any]:
    if kind not in KINDS:
        raise ValueError(f"Unknown dataset kind '{kind}'. Expected one of {KINDS}.")
    return json.loads((SCHEMA_DIR / f"{kind}.json").read_text(encoding="utf-8"))


def read_table(filename: str, content: bytes) -> list[dict[str, str]]:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h or "").strip() for h in rows[0]]
        return [{headers[i]: ("" if v is None else (v.isoformat() if isinstance(v, datetime) else str(v)))
                 for i, v in enumerate(r) if i < len(headers)} for r in rows[1:] if any(v is not None for v in r)]
    if name.endswith(".csv"):
        text = content.decode("utf-8-sig")
        return list(csv.DictReader(io.StringIO(text)))
    raise ValueError("Only .csv and .xlsx files are supported.")


def _coerce(value: str, typ: str | None) -> Any:
    v = (value or "").strip()
    if v == "":
        return None
    if typ == "int":
        return int(float(v))
    if typ == "float":
        return float(v)
    if typ == "bool":
        return v.lower() in TRUE
    if typ == "list":
        sep = ";" if ";" in v else "|" if "|" in v else ","
        return [x.strip() for x in v.split(sep) if x.strip()]
    if typ == "datetime":
        dt = datetime.fromisoformat(v.replace("Z", "+00:00")) if "T" in v or "-" in v else None
        if dt is None:
            raise ValueError(f"bad datetime '{v}'")
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return v


def map_rows(kind: str, rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    schema = load_schema(kind)
    cols: dict[str, dict] = schema["columns"]
    out, errors = [], []
    headers = list(rows[0].keys()) if rows else []
    lower = {h.strip().lower(): h for h in headers}
    resolved: dict[str, str | None] = {}
    for field_name, spec in cols.items():
        resolved[field_name] = next((lower[a.lower()] for a in spec["aliases"] if a.lower() in lower), None)
    used = {h for h in resolved.values() if h}
    unmapped = [h for h in headers if h not in used]
    for i, raw in enumerate(rows, start=2):  # row 1 = header
        rec: dict[str, Any] = {}
        try:
            for field_name, spec in cols.items():
                src = resolved[field_name]
                val = _coerce(raw.get(src, "") if src else "", spec.get("type"))
                if val is None:
                    if spec.get("required"):
                        raise ValueError(f"missing required column '{field_name}'")
                    val = spec.get("default")
                rec[field_name] = val
            out.append(rec)
        except (ValueError, TypeError) as exc:
            errors.append({"row": i, "error": str(exc)})
    return out, errors, unmapped


def _source_conflict(existing: Any, source: str, replace: bool, report: ImportReport, row: int, key: str) -> bool:
    if existing is not None and existing.data_source != source and not replace:
        report.skipped += 1
        report.errors.append({"row": row, "error": f"'{key}' exists from source {existing.data_source}; not overwritten"})
        return True
    return False


def import_rows(
    db: Session,
    kind: str,
    rows: list[dict[str, str]],
    *,
    data_source: str,
    imported_by: str,
    filename: str = "upload",
    dry_run: bool = False,
    replace_other_sources: bool = False,
    embed: bool = True,
    date_shift_days: float = 0.0,
) -> ImportReport:
    if data_source not in (DataSource.SYNTHETIC.value, DataSource.OFFICIAL.value):
        raise ValueError("data_source must be SYNTHETIC or OFFICIAL")
    report = ImportReport(kind=kind, total=len(rows))
    mapped, errors, unmapped = map_rows(kind, rows)
    report.errors.extend(errors)
    report.skipped += len(errors)
    report.unmapped_columns = unmapped
    report.preview = [{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in r.items()} for r in mapped[:5]]

    if dry_run:
        _log(db, report, filename, data_source, imported_by, "dry_run")
        db.commit()
        return report

    if kind == "grievance_history":
        _history(db, mapped, report, data_source, replace_other_sources, embed=embed, shift_days=date_shift_days)
    else:
        {"departments": _departments, "categories": _categories, "officers": _officers}[kind](
            db, mapped, report, data_source, replace_other_sources)
    _log(db, report, filename, data_source, imported_by, "completed")
    db.commit()
    return report


def _log(db: Session, r: ImportReport, filename: str, source: str, by: str, status: str) -> None:
    db.add(DatasetImport(kind=r.kind, filename=filename[:300], data_source=source, status=status, rows_total=r.total,
                         rows_created=r.created, rows_updated=r.updated, rows_skipped=r.skipped,
                         errors=r.errors[:200], imported_by=by))


def _departments(db: Session, rows, report: ImportReport, source: str, replace: bool) -> None:
    for i, r in enumerate(rows, start=2):
        d = db.scalar(select(Department).where(Department.code == r["code"]))
        if _source_conflict(d, source, replace, report, i, r["code"]):
            continue
        if d is None:
            d = Department(code=r["code"])
            db.add(d)
            report.created += 1
        else:
            report.updated += 1
        for k in ("name", "name_hi", "name_mr", "email", "phone", "head_officer_code", "escalation_contact"):
            setattr(d, k, r.get(k))
        d.data_source = source
    db.flush()


def _categories(db: Session, rows, report: ImportReport, source: str, replace: bool) -> None:
    depts = {d.code: d for d in db.scalars(select(Department))}
    for i, r in enumerate(rows, start=2):
        dept = depts.get(r["department_code"])
        if dept is None:
            report.skipped += 1
            report.errors.append({"row": i, "error": f"unknown department '{r['department_code']}' — import departments first"})
            continue
        c = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == r["code"]))
        if _source_conflict(c, source, replace, report, i, r["code"]):
            continue
        if c is None:
            c = GrievanceCategory(code=r["code"])
            db.add(c)
            report.created += 1
        else:
            report.updated += 1
        c.name_en, c.name_hi, c.name_mr = r["name_en"], r.get("name_hi"), r.get("name_mr")
        c.description = r.get("description") or ""
        c.department_id = dept.id
        c.sla_hours = int(r.get("sla_hours") or 72)
        c.is_sensitive = bool(r.get("is_sensitive"))
        c.hide_identity = bool(r.get("hide_identity")) or c.is_sensitive
        c.confidence_threshold = float(r.get("confidence_threshold") or 0.7)
        c.auto_close_allowed = bool(r.get("auto_close_allowed")) and not c.is_sensitive
        c.default_urgency = r.get("default_urgency") if r.get("default_urgency") in {"low", "medium", "high", "critical"} else "medium"
        c.keywords = {"en": r.get("keywords_en") or [], "hi": r.get("keywords_hi") or [], "mr": r.get("keywords_mr") or []}
        c.data_source = source
    db.flush()


def _officers(db: Session, rows, report: ImportReport, source: str, replace: bool, create_accounts: bool = True) -> None:
    from app.core.config import get_settings

    depts = {d.code: d for d in db.scalars(select(Department))}
    pw_hash = hash_password(get_settings().demo_password) if source == DataSource.SYNTHETIC.value else None
    for i, r in enumerate(rows, start=2):
        dept = depts.get(r["department_code"])
        if dept is None:
            report.skipped += 1
            report.errors.append({"row": i, "error": f"unknown department '{r['department_code']}'"})
            continue
        o = db.scalar(select(Officer).where(Officer.code == r["code"]))
        if _source_conflict(o, source, replace, report, i, r["code"]):
            continue
        if o is None:
            o = Officer(code=r["code"])
            db.add(o)
            report.created += 1
        else:
            report.updated += 1
        o.name, o.department_id = r["name"], dept.id
        o.designation = r.get("designation") or "Officer"
        o.wards = r.get("wards") or []
        o.max_active_cases = int(r.get("max_active_cases") or 25)
        o.handles_sensitive = bool(r.get("handles_sensitive"))
        o.data_source = source
        email = (r.get("email") or "").strip().lower()
        if create_accounts and email and o.user_id is None:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                # SYNTHETIC officers get the demo password; OFFICIAL officers get an unusable
                # password and must be issued credentials by an administrator.
                user = User(email=email, full_name=o.name, phone=r.get("phone"), role=Role.OFFICER.value,
                            password_hash=pw_hash or "!disabled", data_source=source, is_active=pw_hash is not None)
                db.add(user)
                db.flush()
            o.user_id = user.id
    db.flush()


def _history(db: Session, rows, report: ImportReport, source: str, replace: bool, *, embed: bool, shift_days: float) -> None:
    from datetime import timedelta

    from app.llm import embeddings

    cats = {c.code: c for c in db.scalars(select(GrievanceCategory))}
    depts = {d.code: d for d in db.scalars(select(Department))}
    offs = {o.code: o for o in db.scalars(select(Officer))}
    prefix = "HIS" if source == DataSource.OFFICIAL.value else "SYN"
    new_rows: list[Grievance] = []
    shift = timedelta(days=shift_days)
    for i, r in enumerate(rows, start=2):
        cat = cats.get(r["category_code"])
        if cat is None:
            report.skipped += 1
            report.errors.append({"row": i, "error": f"unknown category '{r['category_code']}'"})
            continue
        ext = f"{source}:{r['external_ref']}"
        g = db.scalar(select(Grievance).where(Grievance.external_ref == ext))
        if g is not None:
            report.skipped += 1  # same source & ref already imported: idempotent
            continue
        status = (r.get("status") or "CLOSED").upper()
        if status not in {s.value for s in GrievanceStatus}:
            status = GrievanceStatus.CLOSED.value
        dept = depts.get(r.get("department_code") or "") or cat.department
        created = r["created_at"] + shift
        resolved = (r.get("resolved_at") + shift) if r.get("resolved_at") else None
        g = Grievance(
            public_id=_public_ref(prefix, str(r["external_ref"])),
            external_ref=ext, citizen_id=None, title=(r.get("title") or cat.name_en)[:300],
            description=r["description"][:8000], language=r.get("language") if r.get("language") in {"en", "hi", "mr"} else "en",
            input_mode="import", location_text=r.get("location_text"), ward=r.get("ward"),
            latitude=r.get("latitude"), longitude=r.get("longitude"), category_id=cat.id,
            department_id=dept.id if dept else None,
            assigned_officer_id=offs[r["officer_code"]].id if r.get("officer_code") in offs else None,
            urgency=r.get("urgency") if r.get("urgency") in {"low", "medium", "high", "critical"} else cat.default_urgency,
            status=status, is_sensitive=cat.is_sensitive, identity_hidden=cat.hide_identity,
            resolution_summary=r.get("resolution_summary"), citizen_rating=r.get("citizen_rating"),
            is_historical=True, data_source=source, created_at=created, updated_at=resolved or created,
            sla_due_at=created + timedelta(hours=cat.sla_hours), resolved_at=resolved,
            closed_at=resolved if status == GrievanceStatus.CLOSED.value else None,
        )
        db.add(g)
        new_rows.append(g)
        report.created += 1
    db.flush()
    if embed and new_rows:
        model = embeddings.provider_name()
        for start in range(0, len(new_rows), 64):
            chunk = new_rows[start:start + 64]
            vecs = embeddings.embed_texts([f"{g.title}. {g.description}" for g in chunk])
            for g, v in zip(chunk, vecs):
                g.embedding, g.embedding_model = v, model
        db.flush()


def _public_ref(prefix: str, ref: str) -> str:
    ref = ref.strip()[-24:]
    return ref if ref.upper().startswith(f"{prefix}-") else f"{prefix}-{ref}"


def import_file(db: Session, kind: str, path: Path, **kwargs) -> ImportReport:
    content = Path(path).read_bytes()
    return import_rows(db, kind, read_table(path.name, content), filename=path.name, **kwargs)


def reembed_all(db: Session) -> int:
    """Recompute embeddings (e.g. after switching EMBEDDING_PROVIDER)."""
    from app.llm import embeddings

    rows = db.scalars(select(Grievance)).all()
    model = embeddings.provider_name()
    for start in range(0, len(rows), 64):
        chunk = rows[start:start + 64]
        for g, v in zip(chunk, embeddings.embed_texts([f"{g.title}. {g.description}" for g in chunk])):
            g.embedding, g.embedding_model = v, model
    db.commit()
    return len(rows)

