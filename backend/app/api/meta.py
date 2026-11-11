"""Public metadata (no auth): categories, departments, wards and system capability status."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db, is_postgres
from app.llm import embeddings, stt
from app.llm.client import provider_status
from app.models import Department, Grievance, GrievanceCategory
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
