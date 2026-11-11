"""Administrator API: category master, departments/officers, dataset import, webhooks, agent jobs."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents import orchestrator
from app.core.config import get_settings
from app.core.deps import require_admin
from app.core.security import hash_password
from app.core.time import as_aware
from app.db.session import get_db
from app.models import (
    AuditEvent,
    DatasetImport,
    Department,
    Grievance,
    GrievanceCategory,
    Officer,
    User,
    Webhook,
    WebhookDelivery,
)
from app.models.enums import OPEN_STATUSES, DataSource, Role
from app.schemas.api import CategoryUpdate, OfficerCreate, OfficerUpdate, WebhookIn
from app.services import audit, importer
from app.services.audit import actor_of
from app.services.webhooks import EVENTS, deliver_pending

router = APIRouter(prefix="/admin", tags=["admin"])
OPEN = [s.value for s in OPEN_STATUSES]


def _iso(dt):
    return as_aware(dt).isoformat() if dt else None


# ---------------------------------------------------------------- category master
@router.get("/categories")
def list_categories(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        {"id": c.id, "code": c.code, "name_en": c.name_en, "name_hi": c.name_hi, "name_mr": c.name_mr,
         "description": c.description, "department_code": c.department.code if c.department else None,
         "sla_hours": c.sla_hours, "is_sensitive": c.is_sensitive, "hide_identity": c.hide_identity,
         "confidence_threshold": c.confidence_threshold, "auto_close_allowed": c.auto_close_allowed,
         "default_urgency": c.default_urgency, "keywords": c.keywords, "is_active": c.is_active,
         "data_source": c.data_source, "updated_at": _iso(c.updated_at)}
        for c in db.scalars(select(GrievanceCategory).order_by(GrievanceCategory.code))
    ]


@router.patch("/categories/{code}")
def update_category(code: str, body: CategoryUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == code))
    if c is None:
        raise HTTPException(404, "Category not found")
    changes = body.model_dump(exclude_none=True)
    before = {k: getattr(c, k) for k in changes if k != "department_code"}
    if "department_code" in changes:
        d = db.scalar(select(Department).where(Department.code == changes.pop("department_code")))
        if d is None:
            raise HTTPException(404, "Department not found")
        before["department_id"] = c.department_id
        c.department_id = d.id
    for k, v in changes.items():
        setattr(c, k, v)
    if c.is_sensitive:  # invariants: sensitive => identity hidden, never auto-closed
        c.hide_identity, c.auto_close_allowed = True, False
    actor, actor_type = actor_of(user)
    audit.record(db, action="category.updated", actor=actor, actor_type=actor_type,
                 explanation={"category": code, "before": before, "after": body.model_dump(exclude_none=True)})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- departments / officers
@router.get("/departments")
def list_departments(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    open_counts = dict(db.execute(select(Grievance.department_id, func.count()).where(
        Grievance.status.in_(OPEN), Grievance.is_historical.is_(False)).group_by(Grievance.department_id)).all())
    return [
        {"code": d.code, "name": d.name, "name_hi": d.name_hi, "name_mr": d.name_mr, "email": d.email, "phone": d.phone,
         "head_officer_code": d.head_officer_code, "officers": len(d.officers), "open_grievances": open_counts.get(d.id, 0),
         "categories": [c.code for c in d.categories], "data_source": d.data_source, "is_active": d.is_active}
        for d in db.scalars(select(Department).order_by(Department.name))
    ]


@router.get("/officers")
def list_officers(department: str | None = None, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(Officer).order_by(Officer.code)
    if department:
        q = q.join(Department).where(Department.code == department)
    loads = dict(db.execute(select(Grievance.assigned_officer_id, func.count()).where(
        Grievance.status.in_(OPEN), Grievance.is_historical.is_(False)).group_by(Grievance.assigned_officer_id)).all())
    return [
        {"code": o.code, "name": o.name, "designation": o.designation, "department_code": o.department.code,
         "email": o.user.email if o.user else None, "wards": o.wards, "max_active_cases": o.max_active_cases,
         "open_cases": loads.get(o.id, 0), "handles_sensitive": o.handles_sensitive, "is_active": o.is_active,
         "has_login": bool(o.user and o.user.is_active), "data_source": o.data_source}
        for o in db.scalars(q)
    ]


@router.post("/officers", status_code=201)
def create_officer(body: OfficerCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    dept = db.scalar(select(Department).where(Department.code == body.department_code))
    if dept is None:
        raise HTTPException(404, "Department not found")
    if db.scalar(select(User).where(User.email == body.email.lower())) or db.scalar(select(Officer).where(Officer.code == body.officer_code)):
        raise HTTPException(409, "E-mail or officer code already exists")
    u = User(email=body.email.lower(), full_name=body.full_name, password_hash=hash_password(body.password),
             role=Role.OFFICER.value, data_source=DataSource.LIVE.value)
    db.add(u)
    db.flush()
    db.add(Officer(code=body.officer_code, user_id=u.id, department_id=dept.id, name=body.full_name, designation=body.designation,
                   wards=body.wards, max_active_cases=body.max_active_cases, handles_sensitive=body.handles_sensitive,
                   data_source=DataSource.LIVE.value))
    actor, actor_type = actor_of(user)
    audit.record(db, action="officer.created", actor=actor, actor_type=actor_type, explanation={"officer": body.officer_code})
    db.commit()
    return {"ok": True}


@router.patch("/officers/{code}")
def update_officer(code: str, body: OfficerUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    o = db.scalar(select(Officer).where(Officer.code == code))
    if o is None:
        raise HTTPException(404, "Officer not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(o, k, v)
    if body.is_active is not None and o.user:
        o.user.is_active = body.is_active
    actor, actor_type = actor_of(user)
    audit.record(db, action="officer.updated", actor=actor, actor_type=actor_type,
                 explanation={"officer": code, **body.model_dump(exclude_none=True)})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- datasets
@router.get("/datasets")
def dataset_overview(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    def by_source(model, extra=None):
        q = select(model.data_source, func.count()).group_by(model.data_source)
        if extra is not None:
            q = q.where(extra)
        return dict(db.execute(q).all())

    return {
        "summary": {
            "categories": by_source(GrievanceCategory), "departments": by_source(Department), "officers": by_source(Officer),
            "grievance_history": by_source(Grievance, Grievance.is_historical.is_(True)),
            "live_grievances": by_source(Grievance, Grievance.is_historical.is_(False)),
        },
        "schemas": {k: importer.load_schema(k) for k in importer.KINDS},
        "imports": [
            {"id": i.id, "kind": i.kind, "filename": i.filename, "data_source": i.data_source, "status": i.status,
             "rows_total": i.rows_total, "rows_created": i.rows_created, "rows_updated": i.rows_updated,
             "rows_skipped": i.rows_skipped, "errors": i.errors[:20], "imported_by": i.imported_by, "created_at": _iso(i.created_at)}
            for i in db.scalars(select(DatasetImport).order_by(DatasetImport.id.desc()).limit(50))
        ],
    }


@router.post("/datasets/import")
async def import_dataset(
    kind: str = Form(...),
    data_source: str = Form(default="OFFICIAL"),
    dry_run: bool = Form(default=True),
    replace_other_sources: bool = Form(default=False),
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if kind not in importer.KINDS:
        raise HTTPException(422, f"kind must be one of {importer.KINDS}")
    if data_source not in ("OFFICIAL", "SYNTHETIC"):
        raise HTTPException(422, "data_source must be OFFICIAL or SYNTHETIC")
    content = await file.read()
    if len(content) > get_settings().max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "File too large")
    try:
        rows = importer.read_table(file.filename or "upload.csv", content)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(422, f"Could not read file: {exc}")
    if not rows:
        raise HTTPException(422, "The file has no data rows")
    actor, actor_type = actor_of(user)
    rep = importer.import_rows(db, kind, rows, data_source=data_source, imported_by=actor, filename=file.filename or "upload",
                               dry_run=dry_run, replace_other_sources=replace_other_sources)
    audit.record(db, action="dataset.import" + (".dry_run" if dry_run else ""), actor=actor, actor_type=actor_type,
                 explanation={"kind": kind, "source": data_source, "created": rep.created, "updated": rep.updated,
                              "skipped": rep.skipped, "replace_other_sources": replace_other_sources})
    db.commit()
    return {"kind": rep.kind, "dry_run": dry_run, "total": rep.total, "created": rep.created, "updated": rep.updated,
            "skipped": rep.skipped, "errors": rep.errors[:100], "unmapped_columns": rep.unmapped_columns, "preview": rep.preview}


# ---------------------------------------------------------------- webhooks
@router.get("/webhooks")
def list_webhooks(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    hooks = db.scalars(select(Webhook).order_by(Webhook.id)).all()
    return {"events": EVENTS, "items": [
        {"id": h.id, "name": h.name, "url": h.url, "events": h.events, "is_active": h.is_active, "created_at": _iso(h.created_at),
         "deliveries": [{"id": d.id, "event": d.event, "status": d.status, "attempts": d.attempts, "response_code": d.response_code,
                         "last_error": d.last_error, "created_at": _iso(d.created_at)}
                        for d in db.scalars(select(WebhookDelivery).where(WebhookDelivery.webhook_id == h.id)
                                            .order_by(WebhookDelivery.id.desc()).limit(10))]}
        for h in hooks]}


@router.post("/webhooks", status_code=201)
def create_webhook(body: WebhookIn, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    bad = [e for e in body.events if e not in EVENTS]
    if bad:
        raise HTTPException(422, f"Unknown events: {bad}")
    h = Webhook(name=body.name, url=body.url, events=body.events, is_active=body.is_active)
    db.add(h)
    actor, actor_type = actor_of(user)
    audit.record(db, action="webhook.created", actor=actor, actor_type=actor_type, explanation={"name": body.name, "events": body.events})
    db.commit()
    return {"id": h.id}


@router.patch("/webhooks/{hid}")
def toggle_webhook(hid: int, is_active: bool = Query(...), user: User = Depends(require_admin), db: Session = Depends(get_db)):
    h = db.get(Webhook, hid)
    if h is None:
        raise HTTPException(404, "Webhook not found")
    h.is_active = is_active
    db.commit()
    return {"ok": True}


@router.delete("/webhooks/{hid}", status_code=204)
def delete_webhook(hid: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    h = db.get(Webhook, hid)
    if h is None:
        raise HTTPException(404, "Webhook not found")
    db.delete(h)
    actor, actor_type = actor_of(user)
    audit.record(db, action="webhook.deleted", actor=actor, actor_type=actor_type, explanation={"id": hid})
    db.commit()


@router.post("/webhooks/deliver")
def deliver_now(background: BackgroundTasks, _: User = Depends(require_admin)):
    background.add_task(deliver_pending)
    return {"queued": True}


# ---------------------------------------------------------------- agent jobs & audit
@router.post("/jobs/sla-scan")
def run_sla_scan(background: BackgroundTasks, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    out = orchestrator.sla_scan(db)
    background.add_task(deliver_pending)
    return out


@router.post("/jobs/auto-close")
def run_auto_close(background: BackgroundTasks, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    out = orchestrator.auto_close(db)
    background.add_task(deliver_pending)
    return out


@router.get("/audit")
def audit_log(
    actor_type: str | None = None, action: str | None = None, grievance: str | None = None,
    limit: int = Query(default=100, le=500), offset: int = 0,
    _: User = Depends(require_admin), db: Session = Depends(get_db),
):
    q = select(AuditEvent)
    if actor_type:
        q = q.where(AuditEvent.actor_type == actor_type)
    if action:
        q = q.where(AuditEvent.action.like(f"{action}%"))
    if grievance:
        q = q.where(AuditEvent.grievance_public_id == grievance)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(AuditEvent.id.desc()).offset(offset).limit(limit)).all()
    return {"total": total, "items": [
        {"id": a.id, "grievance_id": a.grievance_public_id, "actor": a.actor, "actor_type": a.actor_type, "action": a.action,
         "provider": a.provider, "model": a.model, "confidence": a.confidence, "explanation": a.explanation,
         "policy_refs": a.policy_refs, "trace_id": a.trace_id, "created_at": _iso(a.created_at)} for a in rows]}
