"""Role-based dashboards: department-admin scope, profile field permissions, password change,
notification preferences and system-admin user management."""
import pytest
from sqlalchemy import select

from app.models import Grievance, Notification, User
from app.services import notifications
from tests.conftest import PASSWORD, login, new_citizen, submit

WATER_TEXT = "No water supply in Kasba Peth for the last 4 days. Taps are completely dry."
ROADS_TEXT = "Huge potholes near Station Road, vehicles are getting damaged daily."


@pytest.fixture()
def water_admin(client):
    return login(client, "deptadmin.water@example.org")


# ---------------------------------------------------------------- identity & routing data
def test_dept_admin_profile_reports_role_and_department(client, water_admin):
    me = client.get("/api/v1/auth/me", headers=water_admin).json()
    assert me["role"] == "dept_admin"
    assert me["department_code"] == "WATER"
    assert "Manage department officers" in me["permissions"]
    assert "full_name" not in me["editable_fields"]


# ---------------------------------------------------------------- department scope
def test_dept_admin_sees_only_own_department(client, citizen, water_admin):
    water = submit(client, citizen, WATER_TEXT)
    roads = submit(client, citizen, ROADS_TEXT)
    assert water["department"]["code"] == "WATER" and roads["department"]["code"] == "ROADS"

    ids = {g["public_id"] for g in client.get("/api/v1/officer/queue?scope=department&include_closed=true", headers=water_admin).json()}
    assert water["public_id"] in ids and roads["public_id"] not in ids
    assert client.get(f"/api/v1/officer/grievances/{water['public_id']}", headers=water_admin).status_code == 200
    assert client.get(f"/api/v1/officer/grievances/{roads['public_id']}", headers=water_admin).status_code == 403
    assert client.post(f"/api/v1/officer/grievances/{roads['public_id']}/escalate", headers=water_admin,
                       json={"reason": "Trying another department"}).status_code == 403


def test_dept_admin_cannot_manage_other_department(client, water_admin):
    assert client.get("/api/v1/department/officers", headers=water_admin).status_code == 200
    assert client.get("/api/v1/department/officers?department=ROADS", headers=water_admin).status_code == 403
    assert client.patch("/api/v1/department/officers/OFF-ROADS-01", headers=water_admin, json={"max_active_cases": 40}).status_code == 403


def test_dept_admin_team_update_is_validated_and_audited(client, water_admin, db):
    r = client.patch("/api/v1/department/officers/OFF-WATER-02", headers=water_admin, json={"max_active_cases": 22})
    assert r.status_code == 200, r.text
    team = {o["code"]: o for o in client.get("/api/v1/department/officers", headers=water_admin).json()}
    assert team["OFF-WATER-02"]["max_active_cases"] == 22
    # Fields outside a department admin's remit are rejected, not silently ignored.
    assert client.patch("/api/v1/department/officers/OFF-WATER-02", headers=water_admin,
                        json={"handles_sensitive": True}).status_code == 422
    audit = client.get("/api/v1/admin/audit?action=officer.updated", headers=login(client, "admin@example.org")).json()
    assert any(a["explanation"].get("officer") == "OFF-WATER-02" for a in audit["items"])


def test_dept_admin_cannot_use_system_admin_apis(client, water_admin):
    for path in ("/api/v1/admin/users", "/api/v1/admin/audit", "/api/v1/admin/settings", "/api/v1/analytics/overview"):
        assert client.get(path, headers=water_admin).status_code == 403, path


def test_officer_and_citizen_cannot_use_department_admin_apis(client, citizen):
    officer = login(client, "officer.water@example.org")
    assert client.get("/api/v1/department/officers", headers=officer).status_code == 403
    assert client.get("/api/v1/department/officers", headers=citizen).status_code == 403
    assert client.get("/api/v1/officer/reports", headers=citizen).status_code == 403
    assert client.get("/api/v1/admin/users", headers=officer).status_code == 403


# ---------------------------------------------------------------- dashboard data endpoints
def test_reports_are_scoped_and_export_has_no_identity(client, citizen, water_admin):
    submit(client, citizen, WATER_TEXT)
    rep = client.get("/api/v1/officer/reports?days=30", headers=water_admin).json()
    assert rep["total"] >= 1
    r = client.get("/api/v1/officer/reports/export?days=30", headers=water_admin)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "@" not in r.text  # no e-mail addresses
    rows = r.text.strip().splitlines()[1:]
    assert rows and all(",WATER," in row for row in rows)


def test_activity_and_duplicates_endpoints_respect_scope(client, citizen, water_admin):
    submit(client, citizen, WATER_TEXT)
    roads = submit(client, citizen, ROADS_TEXT)
    act = client.get("/api/v1/officer/activity", headers=water_admin).json()
    assert act and all(a["public_id"] != roads["public_id"] for a in act)
    groups = client.get("/api/v1/officer/duplicates", headers=water_admin).json()
    assert all(m["public_id"] != roads["public_id"] for grp in groups for m in grp["members"])


def test_officer_stats_include_sla_counts(client):
    h = login(client, "officer.water@example.org")
    s = client.get("/api/v1/officer/stats", headers=h).json()
    for key in ("total", "resolved", "at_risk", "breached", "overdue", "assigned_to_me"):
        assert key in s


# ---------------------------------------------------------------- profile
def test_citizen_can_edit_own_profile(client):
    h = new_citizen(client)
    r = client.patch("/api/v1/auth/me", headers=h, json={"full_name": "Asha Patil", "address": "12 Lane, Kasba Peth", "ward": "Ward 3",
                                                          "preferred_language": "mr"})
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["full_name"] == "Asha Patil" and me["address"] == "12 Lane, Kasba Peth" and me["preferred_language"] == "mr"


def test_profile_field_permissions_enforced(client):
    officer = login(client, "officer.water@example.org")
    assert client.patch("/api/v1/auth/me", headers=officer, json={"full_name": "Someone Else"}).status_code == 403
    assert client.patch("/api/v1/auth/me", headers=officer, json={"phone": "+91 90000 11111"}).status_code == 200
    h = new_citizen(client)
    # E-mail and role are never self-editable; unknown fields are rejected outright.
    assert client.patch("/api/v1/auth/me", headers=h, json={"role": "admin"}).status_code == 422
    assert client.patch("/api/v1/auth/me", headers=h, json={"email": "x@example.org"}).status_code == 422
    assert client.patch("/api/v1/auth/me", headers=h, json={"phone": "not a phone"}).status_code == 422
    assert client.get("/api/v1/auth/me", headers=h).json()["role"] == "citizen"


def test_change_password(client):
    email = "pwchange@test.example.org"
    r = client.post("/api/v1/auth/register", json={"email": email, "full_name": "Pw Change", "password": "Passw0rd!x"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.post("/api/v1/auth/change-password", headers=h,
                       json={"current_password": "wrong-one-1", "new_password": "NewPassw0rd"}).status_code == 400
    assert client.post("/api/v1/auth/change-password", headers=h,
                       json={"current_password": "Passw0rd!x", "new_password": "lettersonly"}).status_code == 422
    assert client.post("/api/v1/auth/change-password", headers=h,
                       json={"current_password": "Passw0rd!x", "new_password": "NewPassw0rd"}).status_code == 204
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "Passw0rd!x"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "NewPassw0rd"}).status_code == 200


def test_notification_preferences_are_enforced_but_mandatory_kinds_still_delivered(client, db):
    h = new_citizen(client)
    assert client.patch("/api/v1/auth/me", headers=h, json={"notification_prefs": {"status_updates": False}}).status_code == 200
    assert client.patch("/api/v1/auth/me", headers=h, json={"notification_prefs": {"sla_alerts": False}}).status_code == 422
    uid = client.get("/api/v1/auth/me", headers=h).json()["id"]
    g = submit(client, h, WATER_TEXT)
    grievance = db.scalar(select(Grievance).where(Grievance.public_id == g["public_id"]))
    notifications.notify_citizen(db, grievance, "in_progress", "Work started", "x")
    notifications.notify_citizen(db, grievance, "resolved", "Resolved", "Please confirm")
    db.commit()
    kinds = [n.kind for n in db.scalars(select(Notification).where(Notification.user_id == uid))]
    assert "in_progress" not in kinds and "resolved" in kinds


# ---------------------------------------------------------------- system admin: users
def test_admin_user_management_rules(client, admin, db):
    me = client.get("/api/v1/auth/me", headers=admin).json()
    assert client.patch(f"/api/v1/admin/users/{me['id']}", headers=admin, json={"is_active": False}).status_code == 422
    # dept_admin requires a department; others must not have one
    base = {"full_name": "New Person", "password": "Passw0rd1"}
    assert client.post("/api/v1/admin/users", headers=admin, json={**base, "email": "da1@test.example.org", "role": "dept_admin"}).status_code == 422
    assert client.post("/api/v1/admin/users", headers=admin,
                       json={**base, "email": "c1@test.example.org", "role": "citizen", "department_code": "WATER"}).status_code == 422
    r = client.post("/api/v1/admin/users", headers=admin,
                    json={**base, "email": "da2@test.example.org", "role": "dept_admin", "department_code": "ROADS"})
    assert r.status_code == 201, r.text
    da = login(client, "da2@test.example.org", "Passw0rd1")
    assert client.get("/api/v1/auth/me", headers=da).json()["department_code"] == "ROADS"
    assert client.patch(f"/api/v1/admin/users/{r.json()['id']}", headers=admin, json={"is_active": False}).status_code == 200
    denied = client.post("/api/v1/auth/login", json={"email": "da2@test.example.org", "password": "Passw0rd1"})
    assert denied.status_code == 403 and "deactivated" in denied.json()["detail"]
    listing = client.get("/api/v1/admin/users?role=dept_admin", headers=admin).json()
    assert listing["total"] >= 2 and all(u["role"] == "dept_admin" for u in listing["items"])
    assert db.scalar(select(User).where(User.email == "da2@test.example.org")).is_active is False


def test_admin_settings_expose_no_secrets(client, admin):
    s = client.get("/api/v1/admin/settings", headers=admin).json()
    text = str(s)
    assert "test-secret-not-for-production-use" not in text and PASSWORD not in text
    assert "policy" in s and "providers" in s


# ---------------------------------------------------------------- staff sign-up requests
def test_officer_signup_is_a_request_until_an_admin_approves(client, admin):
    email = "new.officer@test.example.org"
    r = client.post("/api/v1/auth/register", json={"email": email, "full_name": "New Officer", "password": "Passw0rd1",
                                                   "role": "officer", "department_code": "WATER", "designation": "Junior Engineer"})
    assert r.status_code == 201, r.text
    assert r.json()["pending"] is True and "access_token" not in r.json()
    blocked = client.post("/api/v1/auth/login", json={"email": email, "password": "Passw0rd1"})
    assert blocked.status_code == 403 and "awaiting approval" in blocked.json()["detail"]
    # Wrong password still gets the generic answer (no account enumeration).
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong0000"}).status_code == 401
    row = client.get(f"/api/v1/admin/users?q={email}", headers=admin).json()["items"][0]
    assert row["role"] == "officer" and row["is_active"] is False and row["officer_code"].startswith("OFF-WATER-")
    assert client.patch(f"/api/v1/admin/users/{row['id']}", headers=admin, json={"is_active": True}).status_code == 200
    h = login(client, email, "Passw0rd1")
    me = client.get("/api/v1/auth/me", headers=h).json()
    assert me["role"] == "officer" and me["department_code"] == "WATER" and me["handles_sensitive"] is False


def test_staff_signup_requires_a_department(client):
    r = client.post("/api/v1/auth/register", json={"email": "da.req@test.example.org", "full_name": "Dept Person",
                                                   "password": "Passw0rd1", "role": "dept_admin"})
    assert r.status_code == 422
    # Self-registration can never create a system administrator.
    r = client.post("/api/v1/auth/register", json={"email": "sneaky@test.example.org", "full_name": "Sneaky",
                                                   "password": "Passw0rd1", "role": "admin"})
    assert r.status_code == 422
