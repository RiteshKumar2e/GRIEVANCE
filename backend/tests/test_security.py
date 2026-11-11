"""Scenario 10 (+ privacy): unauthorized users cannot access restricted APIs."""
import pytest

from tests.conftest import login, new_citizen, submit

RESTRICTED = [
    ("get", "/api/v1/admin/categories"),
    ("get", "/api/v1/admin/audit"),
    ("get", "/api/v1/analytics/overview"),
    ("get", "/api/v1/observability/traces"),
    ("post", "/api/v1/admin/jobs/sla-scan"),
    ("get", "/api/v1/officer/queue"),
]


@pytest.mark.parametrize("method,path", RESTRICTED)
def test_anonymous_requests_rejected(client, method, path):
    assert getattr(client, method)(path).status_code == 401


@pytest.mark.parametrize("method,path", RESTRICTED)
def test_citizen_cannot_use_staff_apis(client, citizen, method, path):
    assert getattr(client, method)(path, headers=citizen).status_code == 403


def test_officer_cannot_use_admin_apis(client):
    h = login(client, "officer.water@example.org")
    assert client.get("/api/v1/admin/audit", headers=h).status_code == 403
    assert client.get("/api/v1/analytics/overview", headers=h).status_code == 403
    assert client.patch("/api/v1/admin/categories/POTHOLE", headers=h, json={"sla_hours": 1}).status_code == 403


def test_officer_cannot_submit_as_citizen(client):
    h = login(client, "officer.water@example.org")
    assert client.post("/api/v1/citizen/intake/analyze", headers=h, json={"text": "No water in Kasba Peth since 3 days"}).status_code == 403


def test_invalid_and_tampered_tokens_rejected(client, citizen):
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401
    tok = citizen["Authorization"].split()[1]
    tampered = tok[:-4] + ("AAAA" if not tok.endswith("AAAA") else "BBBB")
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered}"}).status_code == 401


def test_citizen_cannot_see_others_grievances(client, citizen):
    g = submit(client, citizen, "Huge potholes near Station Road, vehicles are getting damaged daily.")
    other = new_citizen(client)
    assert client.get(f"/api/v1/citizen/grievances/{g['public_id']}", headers=other).status_code == 404
    assert all(x["public_id"] != g["public_id"] for x in client.get("/api/v1/citizen/grievances", headers=other).json())


def test_officer_of_other_department_forbidden(client, citizen):
    g = submit(client, citizen, "Huge potholes near Station Road, vehicles are getting damaged daily.")
    water = login(client, "officer.water@example.org")
    assert client.get(f"/api/v1/officer/grievances/{g['public_id']}", headers=water).status_code == 403
    assert client.post(f"/api/v1/officer/grievances/{g['public_id']}/status", headers=water,
                       json={"status": "IN_PROGRESS"}).status_code == 403


def test_identity_hidden_for_sensitive_cases(client, citizen):
    g = submit(client, citizen, "The clerk at the ward office demanded a bribe to issue my certificate.")
    vig = client.post("/api/v1/auth/login", json={"email": "admin@example.org", "password": "Demo@12345"}).json()["access_token"]
    d = client.get(f"/api/v1/officer/grievances/{g['public_id']}", headers={"Authorization": f"Bearer {vig}"}).json()
    assert d["citizen"]["protected"] is True
    assert d["citizen"]["name"] == "Identity protected"
    assert d["citizen"]["phone"] is None and d["citizen"]["email"] is None


def test_wrong_password_and_validation(client):
    assert client.post("/api/v1/auth/login", json={"email": "admin@example.org", "password": "wrong"}).status_code == 401
    r = client.post("/api/v1/auth/register", json={"email": "bad", "full_name": "x", "password": "short"})
    assert r.status_code == 422 and r.json()["error"] == "validation_error"


def test_public_trace_requires_valid_token(client):
    assert client.get("/api/v1/public/traces/short").status_code == 404
    assert client.get("/api/v1/public/traces/" + "x" * 32).status_code == 404


def test_shared_trace_has_no_citizen_text(client, citizen, admin):
    text = "Garbage not collected in Sai Colony for 4 days; call me on 9876543210."
    g = submit(client, citizen, text)
    traces = client.get(f"/api/v1/observability/traces?grievance={g['public_id']}", headers=admin).json()["items"]
    tid = traces[0]["trace_id"]
    share = client.post(f"/api/v1/observability/traces/{tid}/share", headers=admin).json()
    pub = client.get(f"/api/v1/public/traces/{share['share_token']}")
    assert pub.status_code == 200
    body = pub.text
    assert "9876543210" not in body and "Sai Colony" not in body and "Garbage not collected" not in body
    assert pub.json()["steps"]


def test_errors_do_not_leak_internals(client, admin):
    r = client.get("/api/v1/officer/grievances/GRV-0000-000000", headers=admin)
    assert r.status_code == 404
    assert "Traceback" not in r.text
