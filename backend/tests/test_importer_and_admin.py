"""Dataset importer, admin APIs, observability and migrations."""
import io
from pathlib import Path

from sqlalchemy import select

from app.models import GrievanceCategory
from tests.conftest import submit

CSV = (
    "Category ID,Category,Department,SLA,Sensitive,Identity_Hiding,Threshold,keywords\n"
    "TREE_FALL,Fallen tree,ROADS,24,no,no,0.7,tree;fallen tree\n"
    "POTHOLE,Potholes (official),ROADS,96,no,no,0.7,pothole\n"
    "BAD_ROW,,ROADS,24,no,no,0.7,\n"
)


def _upload(client, admin, content: bytes, *, dry_run: bool, filename="cats.csv", kind="categories"):
    return client.post("/api/v1/admin/datasets/import", headers=admin,
                       data={"kind": kind, "data_source": "OFFICIAL", "dry_run": str(dry_run).lower()},
                       files={"file": (filename, content, "text/csv")})


def test_dry_run_does_not_write(client, admin, db):
    r = _upload(client, admin, CSV.encode(), dry_run=True)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dry_run"] and body["total"] == 3
    assert any("name_en" in e["error"] for e in body["errors"])
    assert db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == "TREE_FALL")) is None


def test_import_maps_columns_and_never_silently_overwrites(client, admin, db):
    r = _upload(client, admin, CSV.encode(), dry_run=False).json()
    assert r["created"] == 1
    assert any("SYNTHETIC" in e["error"] and "not overwritten" in e["error"] for e in r["errors"])
    db.expire_all()
    tree = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == "TREE_FALL"))
    assert tree.data_source == "OFFICIAL" and tree.sla_hours == 24 and tree.keywords["en"] == ["tree", "fallen tree"]
    pothole = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == "POTHOLE"))
    assert pothole.data_source == "SYNTHETIC" and pothole.name_en != "Potholes (official)"
    hist = client.get("/api/v1/admin/datasets", headers=admin).json()
    assert hist["imports"][0]["kind"] == "categories"


def test_xlsx_import(client, admin):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["department_code", "name"])
    ws.append(["PARKS", "Parks & Gardens"])
    buf = io.BytesIO()
    wb.save(buf)
    r = _upload(client, admin, buf.getvalue(), dry_run=False, filename="d.xlsx", kind="departments").json()
    assert r["created"] == 1


def test_admin_category_update_keeps_sensitive_invariants(client, admin, db):
    r = client.patch("/api/v1/admin/categories/BRIBERY", headers=admin, json={"auto_close_allowed": True, "sla_hours": 48})
    assert r.status_code == 200
    db.expire_all()
    c = db.scalar(select(GrievanceCategory).where(GrievanceCategory.code == "BRIBERY"))
    assert c.sla_hours == 48 and c.auto_close_allowed is False and c.hide_identity is True


def test_analytics_endpoints(client, admin, citizen):
    submit(client, citizen, "Frequent power cuts in Station Road; the transformer keeps tripping.")
    ov = client.get("/api/v1/analytics/overview", headers=admin).json()
    assert ov["total"] > 0 and "SYNTHETIC" in ov["by_data_source"]
    assert "estimate_label" in ov
    for path in ("departments", "trends", "categories", "sla", "agents"):
        assert client.get(f"/api/v1/analytics/{path}", headers=admin).status_code == 200


def test_observability_trace_detail(client, admin, citizen):
    g = submit(client, citizen, "Frequent power cuts in Station Road; the transformer keeps tripping.")
    items = client.get(f"/api/v1/observability/traces?grievance={g['public_id']}", headers=admin).json()["items"]
    t = client.get(f"/api/v1/observability/traces/{items[0]['trace_id']}", headers=admin).json()
    agents = [s["agent"] for s in t["steps"]]
    assert agents[:6] == ["intake", "policy", "rag", "duplicate", "predictive", "actions"]
    rag = next(s for s in t["steps"] if s["agent"] == "rag")
    assert rag["references"] and rag["provider"] == "local-embeddings"


def test_webhook_registration_queues_deliveries(client, admin, citizen, db):
    r = client.post("/api/v1/admin/webhooks", headers=admin,
                    json={"name": "test", "url": "http://127.0.0.1:9/hook", "events": ["grievance.created"]})
    assert r.status_code == 201
    submit(client, citizen, "Frequent power cuts in Station Road; the transformer keeps tripping.")
    hooks = client.get("/api/v1/admin/webhooks", headers=admin).json()["items"]
    assert hooks[-1]["deliveries"], "event should have been queued"
    assert hooks[-1]["deliveries"][0]["event"] == "grievance.created"


def test_alembic_migrations_apply_cleanly(tmp_path: Path):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect

    from app.core.config import BACKEND_DIR

    url = f"sqlite:///{(tmp_path / 'mig.db').as_posix()}"
    eng = create_engine(url)
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["configure_logger"] = False
    with eng.connect() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
        conn.commit()
    tables = set(inspect(eng).get_table_names())
    assert {"grievances", "audit_events", "sla_records", "duplicate_groups", "retrieved_precedents", "agent_runs"} <= tables
    eng.dispose()
