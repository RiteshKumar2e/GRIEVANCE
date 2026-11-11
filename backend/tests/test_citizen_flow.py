"""Scenarios 1, 2 and 9: submit+confirm, tracking, dispute/reopen."""
from sqlalchemy import select

from app.models import Grievance, IntakeDraft
from tests.conftest import login, new_citizen, submit

WATER = "No water supply in Shivaji Nagar for the last 4 days. The taps are completely dry and the tanker never came."


def test_analyze_returns_draft_without_creating_grievance(client, citizen, db):
    before = db.scalar(select(Grievance.id).order_by(Grievance.id.desc()))
    r = client.post("/api/v1/citizen/intake/analyze", json={"text": WATER}, headers=citizen)
    assert r.status_code == 200
    body = r.json()
    ex = body["extraction"]
    assert ex["category_code"] == "WATER_SUPPLY"
    assert ex["department"]["code"] == "WATER"
    assert ex["ward"] == "Ward 1"
    assert ex["language"] == "en"
    assert "policy_preview" in ex
    # Nothing was submitted: no new grievance row exists.
    assert db.scalar(select(Grievance.id).order_by(Grievance.id.desc())) == before
    assert db.scalar(select(IntakeDraft).where(IntakeDraft.token == body["draft_token"])).status == "pending"


def test_submission_requires_explicit_confirmation(client, citizen):
    token = client.post("/api/v1/citizen/intake/analyze", json={"text": WATER}, headers=citizen).json()["draft_token"]
    r = client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": False}, headers=citizen)
    assert r.status_code == 409
    assert r.json()["error"] == "policy_violation"


def test_citizen_submits_and_confirms_grievance(client, citizen):
    g = submit(client, citizen, WATER)
    assert g["public_id"].startswith("GRV-")
    assert g["category"]["code"] == "WATER_SUPPLY"
    assert g["department"]["code"] == "WATER"
    assert g["status"] in ("ASSIGNED", "PENDING_REVIEW")
    assert g["data_source"] == "LIVE"
    assert g["sla"]["due_at"]
    # Confirmed drafts cannot be submitted twice.
    hist = [h["to_status"] for h in g["status_history"]]
    assert hist[0] == "SUBMITTED"


def test_draft_cannot_be_confirmed_twice_or_by_another_user(client, citizen):
    token = client.post("/api/v1/citizen/intake/analyze", json={"text": WATER}, headers=citizen).json()["draft_token"]
    other = new_citizen(client)
    assert client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": True}, headers=other).status_code == 403
    assert client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": True}, headers=citizen).status_code == 201
    assert client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": True}, headers=citizen).status_code == 400


def test_citizen_tracks_individual_grievance(client, citizen):
    g = submit(client, citizen, WATER)
    lst = client.get("/api/v1/citizen/grievances", headers=citizen).json()
    assert any(x["public_id"] == g["public_id"] for x in lst)
    detail = client.get(f"/api/v1/citizen/grievances/{g['public_id']}", headers=citizen).json()
    assert detail["public_id"] == g["public_id"]
    assert len(detail["status_history"]) >= 2
    # Citizens do not see internal AI/audit fields.
    assert "audit" not in detail and "policy_explanation" not in detail
    notes = client.get("/api/v1/notifications", headers=citizen).json()
    assert any(n["grievance_id"] == g["public_id"] for n in notes["items"])


def test_multilingual_intake_hindi_and_marathi(client, citizen):
    hi = client.post("/api/v1/citizen/intake/analyze", headers=citizen,
                     json={"text": "Laxmi Road में 5 दिनों से कचरा नहीं उठाया गया, कचरा सड़क पर फैल रहा है।"}).json()["extraction"]
    assert hi["language"] == "hi" and hi["category_code"] == "GARBAGE" and hi["ward"] == "Ward 7"
    mr = client.post("/api/v1/citizen/intake/analyze", headers=citizen,
                     json={"text": "Market Yard येथील मुख्य रस्त्यावर मोठे खड्डे पडले आहेत, रोज दुचाकी घसरत आहेत."}).json()["extraction"]
    assert mr["language"] == "mr" and mr["category_code"] == "POTHOLE" and mr["ward"] == "Ward 8"


def _resolve(client, public_id, officer_headers):
    r = client.post(f"/api/v1/officer/grievances/{public_id}/status", headers=officer_headers,
                    json={"status": "IN_PROGRESS", "note": "On it"})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/v1/officer/grievances/{public_id}/status", headers=officer_headers,
                    json={"status": "RESOLVED", "resolution_summary": "Valve replaced and supply restored."})
    assert r.status_code == 200, r.text


def test_disputed_resolution_reopens_grievance(client, citizen, admin):
    g = submit(client, citizen, WATER)
    if g["status"] == "PENDING_REVIEW":
        client.post(f"/api/v1/officer/grievances/{g['public_id']}/review", headers=admin, json={"note": "Verified"})
    _resolve(client, g["public_id"], admin)
    r = client.post(f"/api/v1/citizen/grievances/{g['public_id']}/dispute", headers=citizen,
                    json={"reason": "Water is still not coming in our lane."})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "REOPENED"
    assert d["reopen_count"] == 1
    assert [h["to_status"] for h in d["status_history"]][-1] == "REOPENED"


def test_citizen_confirms_resolution_closes(client, citizen, admin):
    g = submit(client, citizen, WATER)
    if g["status"] == "PENDING_REVIEW":
        client.post(f"/api/v1/officer/grievances/{g['public_id']}/review", headers=admin, json={"note": "Verified"})
    _resolve(client, g["public_id"], admin)
    r = client.post(f"/api/v1/citizen/grievances/{g['public_id']}/confirm-resolution", headers=citizen,
                    json={"rating": 5, "comment": "Fixed, thanks"})
    assert r.status_code == 200 and r.json()["status"] == "CLOSED"


def test_officer_login_and_queue(client):
    h = login(client, "officer.water@example.org")
    me = client.get("/api/v1/auth/me", headers=h).json()
    assert me["role"] == "officer" and me["department_code"] == "WATER"
    assert client.get("/api/v1/officer/queue?scope=department", headers=h).status_code == 200
