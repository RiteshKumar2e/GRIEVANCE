"""Development seed: SYNTHETIC datasets, demo accounts and a set of open demo grievances
processed through the real agent pipeline (so the officer/admin dashboards have live data)."""
from __future__ import annotations

import csv
import logging
import random
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.intake import run_intake
from app.agents.orchestrator import auto_close, run_pipeline, sla_scan
from app.core.config import BACKEND_DIR, get_settings
from app.core.security import hash_password
from app.core.time import as_aware, utcnow
from app.models import Department, Grievance, Officer, User
from app.models.enums import ActorType, DataSource, GrievanceStatus, Role
from app.services import geo, importer
from app.services.grievances import new_public_id, record_initial_status, transition

log = logging.getLogger("grievance.seed")
SYN = BACKEND_DIR / "data" / "synthetic"

DEMO_USERS = [
    ("admin@example.org", "Demo Administrator", Role.ADMIN),
    ("citizen@example.org", "Demo Citizen", Role.CITIZEN),
    ("citizen2@example.org", "Second Demo Citizen", Role.CITIZEN),
]
# Department administrators: (email, name, department code). Created only if the department exists.
DEMO_DEPT_ADMINS = [
    ("deptadmin.water@example.org", "Demo Water Department Admin", "WATER"),
    ("deptadmin.roads@example.org", "Demo Roads Department Admin", "ROADS"),
]

OPEN_DEMO = [
    ("No water supply in Kasba Peth for the last 4 days. Taps are completely dry.", "en", 70),
    ("Kasba Peth मध्ये गेल्या 3 दिवसांपासून पाणी येत नाही. नळ कोरडे आहेत.", "mr", 50),
    ("Water has not come in Kasba Peth since 3 days, the taps are dry in our lane.", "en", 20),
    ("Huge potholes on the main road at Market Yard. Two-wheelers are slipping every day.", "en", 100),
    ("Market Yard की मुख्य सड़क पर बड़े गड्ढे हैं, रोज़ दोपहिया वाहन फिसल रहे हैं।", "hi", 30),
    ("Garbage has not been collected in Laxmi Road for 5 days and it is overflowing onto the road.", "en", 40),
    ("Streetlights near Gandhi Chowk have not been working for 6 days. It is very dark at night.", "en", 60),
    ("A live wire is hanging low near Station Road and sparking. This is dangerous.", "en", 6),
    ("Sewage is overflowing from the manhole at Nehru Colony into houses.", "en", 28),
    ("Indira Nagar मध्ये डासांचा उपद्रव वाढला आहे, डेंग्यूचे रुग्ण आहेत. धूर फवारणी करावी.", "mr", 30),
    ("A pack of stray dogs in Sai Colony chased children; one child was bitten.", "en", 15),
    ("My property tax bill for the house in Ganesh Peth shows double the correct amount.", "en", 90),
    ("The clerk asked for a bribe to issue my certificate at the Shivaji Nagar office.", "en", 10),
    ("A group of men harass women near the bus stop at Ambedkar Nagar every evening.", "en", 8),
    ("Something is wrong near my house, please look into it.", "en", 12),
    ("Buses on the route through MIDC Area are always late and skip the stop.", "en", 45),
    ("The drain near Kasba Peth is blocked and the lane is waterlogged after rain.", "en", 35),
]


def _history_shift_days() -> float:
    """Shift SYNTHETIC history so its most recent record is ~1 day old (keeps demos current)."""
    latest = None
    with open(SYN / "grievance_history.csv", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            dt = datetime.fromisoformat(row["created_at"])
            latest = dt if latest is None or dt > latest else latest
    if latest is None:
        return 0.0
    return max(0.0, (utcnow() - timedelta(days=1) - as_aware(latest)).total_seconds() / 86400)


def seed_datasets(db: Session) -> dict[str, dict]:
    out = {}
    for kind, fname in (("departments", "departments.csv"), ("categories", "categories.csv"),
                        ("officers", "officers.csv"), ("grievance_history", "grievance_history.csv")):
        rep = importer.import_file(db, kind, SYN / fname, data_source=DataSource.SYNTHETIC.value, imported_by="seed",
                                   date_shift_days=_history_shift_days() if kind == "grievance_history" else 0.0)
        out[kind] = {"created": rep.created, "updated": rep.updated, "skipped": rep.skipped, "errors": len(rep.errors)}
    return out


def seed_users(db: Session) -> None:
    pw = hash_password(get_settings().demo_password)
    for email, name, role in DEMO_USERS:
        if db.scalar(select(User).where(User.email == email)) is None:
            db.add(User(email=email, full_name=name, role=role.value, password_hash=pw, phone="+91-9000000000",
                        data_source=DataSource.SYNTHETIC.value))
    for email, name, dept_code in DEMO_DEPT_ADMINS:
        dept = db.scalar(select(Department).where(Department.code == dept_code))
        if dept is not None and db.scalar(select(User).where(User.email == email)) is None:
            db.add(User(email=email, full_name=name, role=Role.DEPT_ADMIN.value, password_hash=pw, department_id=dept.id,
                        data_source=DataSource.SYNTHETIC.value))
    db.commit()


def seed_open_grievances(db: Session) -> int:
    existing = db.scalar(select(func.count()).select_from(Grievance).where(
        Grievance.is_historical.is_(False), Grievance.data_source == DataSource.SYNTHETIC.value))
    if existing:
        return 0
    rng = random.Random(7)
    citizens = db.scalars(select(User).where(User.role == Role.CITIZEN.value).order_by(User.id)).all()
    gaz = geo.gazetteer()
    made = []
    for i, (text, lang, hours_ago) in enumerate(OPEN_DEMO):
        res = run_intake(db, text, language_hint=lang, gazetteer=gaz, use_llm=False)
        from app.agents.orchestrator import _category

        cat = _category(db, res.category_code)
        lat, lon = geo.centroid(res.ward)
        if lat is not None:
            lat, lon = lat + rng.uniform(-0.002, 0.002), lon + rng.uniform(-0.002, 0.002)
        created = utcnow() - timedelta(hours=hours_ago)
        citizen = citizens[i % len(citizens)] if citizens else None
        g = Grievance(
            public_id=new_public_id(db), citizen_id=citizen.id if citizen else None, title=res.title, description=text,
            language=res.language, location_text=res.location_text, ward=res.ward, latitude=lat, longitude=lon,
            category_id=cat.id, department_id=cat.department_id, urgency=res.urgency, status=GrievanceStatus.SUBMITTED.value,
            ai_summary=res.summary, ai_confidence=res.category_confidence, ai_provider=f"{res.provider}:{res.model}",
            data_source=DataSource.SYNTHETIC.value, created_at=created,
        )
        db.add(g)
        db.flush()
        record_initial_status(db, g, f"user:{citizen.id}" if citizen else "SYSTEM", ActorType.CITIZEN.value, "Demo submission (SYNTHETIC).")
        run_pipeline(db, g, intake=res.to_dict())
        db.commit()
        made.append(g)

    # Move a couple of assigned cases forward so every lifecycle state is visible.
    assigned = [g for g in made if g.status == GrievanceStatus.ASSIGNED.value and g.assigned_officer_id]
    for g in assigned[:3]:
        off = db.get(Officer, g.assigned_officer_id)
        actor = f"user:{off.user_id}" if off and off.user_id else "SYSTEM"
        transition(db, g, GrievanceStatus.IN_PROGRESS, actor=actor, actor_type=ActorType.OFFICER.value, note="Site visit scheduled.")
    for g in assigned[3:5]:
        off = db.get(Officer, g.assigned_officer_id)
        actor = f"user:{off.user_id}" if off and off.user_id else "SYSTEM"
        transition(db, g, GrievanceStatus.IN_PROGRESS, actor=actor, actor_type=ActorType.OFFICER.value, note="Work started.")
        g.resolution_summary = "Issue fixed by the field team; please confirm."
        transition(db, g, GrievanceStatus.RESOLVED, actor=actor, actor_type=ActorType.OFFICER.value, note=g.resolution_summary)
    db.commit()
    sla_scan(db)
    return len(made)


def run_seed(db: Session, with_demo_grievances: bool = True) -> dict:
    report = {"datasets": seed_datasets(db)}
    if get_settings().seed_demo_users:
        seed_users(db)
        report["demo_users"] = [u[0] for u in DEMO_USERS]
        if with_demo_grievances:
            report["open_demo_grievances"] = seed_open_grievances(db)
    return report


__all__ = ["run_seed", "seed_datasets", "seed_users", "seed_open_grievances", "auto_close"]
