"""Public metadata (no auth): categories, departments, wards and system capability status."""
import json
import re

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db, is_postgres
from app.llm import embeddings, stt
from app.llm.client import provider_status
from app.core.ratelimit import limiter
from app.core.time import utcnow
from app.models import Department, Grievance, GrievanceCategory, PageView
from app.services import geo

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    return [
        {"code": c.code, "name_en": c.name_en, "name_hi": c.name_hi, "name_mr": c.name_mr, "description": c.description,
         "department_code": c.department.code if c.department else None, "sla_hours": c.sla_hours,
         "is_sensitive": c.is_sensitive, "hide_identity": c.hide_identity, "data_source": c.data_source}
        for c in db.scalars(select(GrievanceCategory).where(GrievanceCategory.is_active.is_(True)).order_by(GrievanceCategory.name_en))
    ]


@router.get("/departments")
def departments(db: Session = Depends(get_db)):
    return [{"code": d.code, "name": d.name, "name_hi": d.name_hi, "name_mr": d.name_mr, "data_source": d.data_source}
            for d in db.scalars(select(Department).where(Department.is_active.is_(True)).order_by(Department.name))]


@router.get("/wards")
def wards():
    return geo.load_wards()


@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    s = get_settings()
    sources = dict(db.execute(select(Grievance.data_source, func.count()).group_by(Grievance.data_source)).all())
    cat_sources = sorted({x for (x,) in db.execute(select(GrievanceCategory.data_source).distinct())})
    return {
        "app": s.app_name, "environment": s.app_env,
        "llm": provider_status(),
        "embeddings": {"provider": embeddings.provider_name()},
        "speech_to_text": {"available": stt.is_available() if s.stt_provider != "disabled" else False, "model": s.whisper_model},
        "database": {"engine": "postgresql+pgvector" if is_postgres() else "sqlite"},
        "data_sources": {"grievances": sources, "category_master": cat_sources},
        "synthetic_data_in_use": "SYNTHETIC" in sources or "SYNTHETIC" in cat_sources,
        "langfuse": {"enabled": s.langfuse_enabled},
    }


_PATH_OK = re.compile(r"^/[A-Za-z0-9/_:\-]{0,199}$")


@router.post("/pageview", status_code=204, response_class=Response)
async def pageview(request: Request, db: Session = Depends(get_db)):
    """Consent-gated, anonymous page-view counter. Stores only (day, route pattern, count).

    Accepts a text/plain JSON body so browsers can send it with navigator.sendBeacon (no CORS preflight)."""
    limiter.check(request, "pageview", limit=240, window=60)
    raw = (await request.body())[:500]
    try:
        path = json.loads(raw or b"{}").get("path", "")
    except (ValueError, AttributeError):
        return Response(status_code=204)
    if not isinstance(path, str) or not _PATH_OK.match(path):
        return Response(status_code=204)
    today = utcnow().date()
    row = db.scalar(select(PageView).where(PageView.day == today, PageView.path == path))
    if row is None:
        db.add(PageView(day=today, path=path, count=1))
    else:
        row.count += 1
    db.commit()
    return Response(status_code=204)
