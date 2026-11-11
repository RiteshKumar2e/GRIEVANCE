"""Scenarios 6, 7, 8, 11: duplicates preserve records, RAG relevance, SLA warnings, AI audit events."""
from datetime import timedelta

from sqlalchemy import func, select

from app.agents.orchestrator import sla_scan
from app.core.time import utcnow
from app.models import AuditEvent, DuplicateGroupMember, Grievance, Notification, SlaRecord, StatusHistory
from tests.conftest import new_citizen, submit

DUP_TEXT = "Sewage is overflowing from the manhole at Indira Nagar into houses for 3 days."


def test_duplicate_detection_preserves_individual_records(client, db):
    c1, c2 = new_citizen(client), new_citizen(client)
    g1 = submit(client, c1, DUP_TEXT)
    g2 = submit(client, c2, "Sewage overflowing from manhole at Indira Nagar entering houses since 3 days.")
    assert g1["public_id"] != g2["public_id"]
    staff = client.post("/api/v1/auth/login", json={"email": "admin@example.org", "password": "Demo@12345"}).json()["access_token"]
    h = {"Authorization": f"Bearer {staff}"}
    d2 = client.get(f"/api/v1/officer/grievances/{g2['public_id']}", headers=h).json()
    assert d2["duplicate_group"] is not None, "second report should be linked"
    assert any(x["public_id"] == g1["public_id"] for x in d2["duplicates"])

    # Both records still exist independently with their own status history, notifications and audit trail.
    rows = db.scalars(select(Grievance).where(Grievance.public_id.in_([g1["public_id"], g2["public_id"]]))).all()
    assert len(rows) == 2
    for row in rows:
        assert db.scalar(select(func.count()).select_from(StatusHistory).where(StatusHistory.grievance_id == row.id)) >= 2
        assert db.scalar(select(func.count()).select_from(Notification).where(Notification.grievance_id == row.id)) >= 1
        assert db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.grievance_id == row.id)) >= 1
    assert rows[0].duplicate_group_id == rows[1].duplicate_group_id
    members = db.scalars(select(DuplicateGroupMember).where(DuplicateGroupMember.group_id == rows[0].duplicate_group_id)).all()
    assert {m.grievance_id for m in members} >= {r.id for r in rows}

    # Each citizen still tracks their own grievance.
    assert client.get(f"/api/v1/citizen/grievances/{g1['public_id']}", headers=c1).status_code == 200
    assert client.get(f"/api/v1/citizen/grievances/{g2['public_id']}", headers=c2).status_code == 200
    assert client.get(f"/api/v1/citizen/grievances/{g1['public_id']}", headers=c2).status_code == 404

    # Unlinking removes only the link.
    r = client.post(f"/api/v1/officer/grievances/{g2['public_id']}/duplicates/{g1['public_id']}/unlink", headers=h,
                    json={"note": "Different manhole"})
    assert r.status_code == 200
    assert db.scalar(select(func.count()).select_from(Grievance).where(Grievance.public_id.in_([g1["public_id"], g2["public_id"]]))) == 2


def test_rag_retrieves_relevant_examples(client, citizen, admin):
    g = submit(client, citizen, "Huge potholes on the main road at Market Yard, two-wheelers are slipping every day.")
    d = client.get(f"/api/v1/officer/grievances/{g['public_id']}", headers=admin).json()
    precedents = d["precedents"]
    assert 1 <= len(precedents) <= 5
    assert precedents[0]["category"] == "POTHOLE"
    assert precedents[0]["scope"] == "category"
    assert all(p["data_source"] == "SYNTHETIC" for p in precedents)
    sims = [p["similarity"] for p in precedents]
    assert sims == sorted(sims, reverse=True)
    assert precedents[0]["public_id"].startswith("SYN-")


def test_sla_warnings_are_generated(client, citizen, db):
    g = submit(client, citizen, "Streetlights near Gandhi Chowk have not been working for 6 days. It is very dark at night.")
    row = db.scalar(select(Grievance).where(Grievance.public_id == g["public_id"]))
    rec = db.scalar(select(SlaRecord).where(SlaRecord.grievance_id == row.id))
    assert rec is not None and rec.breach_probability is not None
    # Move the clock: 80% of the SLA window has elapsed.
    span = timedelta(hours=rec.sla_hours)
    row.created_at = utcnow() - span * 0.8
    rec.due_at = row.created_at + span
    rec.state = "on_track"
    db.commit()
    out = sla_scan(db)
    assert out["at_risk"] >= 1
    db.expire_all()
    assert db.scalar(select(SlaRecord.state).where(SlaRecord.grievance_id == row.id)) == "at_risk"
    assert db.scalar(select(func.count()).select_from(AuditEvent).where(
        AuditEvent.grievance_id == row.id, AuditEvent.action == "sla.warning")) == 1

    # Past the deadline -> breach + escalation.
    rec = db.scalar(select(SlaRecord).where(SlaRecord.grievance_id == row.id))
    rec.due_at = utcnow() - timedelta(hours=1)
    db.commit()
    out = sla_scan(db)
    assert out["breached"] >= 1
    db.expire_all()
    row = db.scalar(select(Grievance).where(Grievance.id == row.id))
    assert row.escalation_level >= 1
    assert db.scalar(select(func.count()).select_from(AuditEvent).where(
        AuditEvent.grievance_id == row.id, AuditEvent.action == "escalation")) >= 1


def test_ai_actions_generate_complete_audit_events(client, citizen, db):
    g = submit(client, citizen, "Garbage has not been collected in Nehru Colony for 5 days and it is overflowing onto the road.")
    row = db.scalar(select(Grievance).where(Grievance.public_id == g["public_id"]))
    events = db.scalars(select(AuditEvent).where(AuditEvent.grievance_id == row.id, AuditEvent.actor == "AI_SYSTEM")).all()
    actions = {e.action for e in events}
    assert {"intake.classification", "policy.decision"} <= actions
    assert any(a.startswith("status.") for a in actions)
    for e in events:
        assert e.actor_type == "AI_SYSTEM"
        assert e.provider and e.model
        assert e.confidence is not None
        assert isinstance(e.explanation, dict) and e.explanation
        assert isinstance(e.policy_refs, list)
        assert e.trace_id
        assert e.grievance_public_id == g["public_id"]
        assert e.created_at is not None
    policy_ev = next(e for e in events if e.action == "policy.decision")
    assert "POL-NOREJECT-01" in policy_ev.policy_refs


def test_recurrence_and_bottlenecks(client, admin):
    rec = client.get("/api/v1/analytics/recurrence?days=60", headers=admin).json()
    assert "SYNTHETIC" in rec["estimate_label"]
    assert any(i["category_code"] == "WATER_SUPPLY" and i["ward"] == "Ward 2" for i in rec["items"])
    b = client.get("/api/v1/analytics/bottlenecks", headers=admin).json()
    assert b["departments"] and b["officers"]
