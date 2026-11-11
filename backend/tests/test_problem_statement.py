"""HackFusion 4.0 problem-statement features: conversational intake, inspectable reasoning,
Langfuse export, n8n/Zapier-compatible webhooks, spam protection, analytics and security headers."""
import hashlib
import hmac
import json

import httpx
from sqlalchemy import select

from app.core.config import get_settings
from app.models import AgentTrace
from app.services import tracing
from tests.conftest import new_citizen, submit


def _chat(client, headers, *msgs, language=None):
    body = {"messages": [{"role": r, "content": c} for r, c in msgs]}
    if language:
        body["language"] = language
    r = client.post("/api/v1/citizen/intake/converse", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_conversational_intake_asks_follow_ups_then_drafts(client, citizen):
    first = "There is a big problem with garbage"
    t1 = _chat(client, citizen, ("user", first))
    assert t1["ready"] is False and t1["draft"] is None
    second = "Garbage has not been collected near Laxmi Road and the dustbin is overflowing onto the street"
    t2 = _chat(client, citizen, ("user", first), ("assistant", t1["reply"]), ("user", second))
    assert t2["ready"] is False and t2["missing"] == ["duration"]
    t3 = _chat(client, citizen, ("user", first), ("assistant", t1["reply"]), ("user", second), ("assistant", t2["reply"]), ("user", "For 5 days now"))
    assert t3["ready"] is True
    ex = t3["draft"]["extraction"]
    assert ex["category_code"] == "GARBAGE" and ex["ward"] == "Ward 7"
    r = client.post(f"/api/v1/citizen/intake/{t3['draft']['draft_token']}/confirm", json={"confirmed": True}, headers=citizen)
    assert r.status_code == 201


def test_conversational_intake_replies_in_citizens_language(client, citizen):
    hi = _chat(client, citizen, ("user", "कचरा बहुत है"), language="hi")
    assert hi["ready"] is False and hi["language"] == "hi"
    assert any("ऀ" <= ch <= "ॿ" for ch in hi["reply"])
    mr = _chat(client, citizen, ("user", "कचरा उचलला नाही आहे"), language="mr")
    assert mr["language"] == "mr" and mr["reply"] != hi["reply"]


def test_citizen_can_skip_follow_ups(client, citizen):
    t1 = _chat(client, citizen, ("user", "Streetlight is not working"))
    t2 = _chat(client, citizen, ("user", "Streetlight is not working"), ("assistant", t1["reply"]), ("user", "skip"))
    assert t2["ready"] is True and t2["draft"]


def test_finish_flag_creates_draft_immediately(client, citizen):
    r = client.post("/api/v1/citizen/intake/converse", headers=citizen,
                    json={"messages": [{"role": "user", "content": "Streetlight broken"}], "finish": True}).json()
    assert r["ready"] is True and r["draft"]


def test_every_agent_step_has_inspectable_reasoning(client, citizen, admin):
    g = submit(client, citizen, "Sewage is overflowing from the manhole at Nehru Colony into houses since 2 days.")
    items = client.get(f"/api/v1/observability/traces?grievance={g['public_id']}", headers=admin).json()["items"]
    t = client.get(f"/api/v1/observability/traces/{items[0]['trace_id']}", headers=admin).json()
    for step in t["steps"]:
        assert step["output"].get("reasoning"), f"{step['agent']} has no reasoning trail"
    policy = next(s for s in t["steps"] if s["agent"] == "policy")
    assert any("POL-CONF-01" in line for line in policy["output"]["reasoning"])
    d = client.get(f"/api/v1/officer/grievances/{g['public_id']}", headers=admin).json()
    assert d["policy_explanation"]["reasoning"] and d["policy_explanation"]["intake_reasoning"]
    # The shared trace keeps the policy reasoning but not the intake reasoning, place names or complaint text.
    tok = client.post(f"/api/v1/observability/traces/{t['trace_id']}/share", headers=admin).json()["share_token"]
    pub = client.get(f"/api/v1/public/traces/{tok}").json()
    shared_policy = next(s for s in pub["steps"] if s["agent"] == "policy")
    assert shared_policy["decision"].get("reasoning")
    assert "reasoning" not in next(s for s in pub["steps"] if s["agent"] == "intake")["decision"]
    dumped = json.dumps(pub)
    assert "overflowing from the manhole" not in dumped and "Nehru Colony" not in dumped


def test_langfuse_export_sends_spans_and_returns_real_url(monkeypatch, client, citizen, db):
    s = get_settings()
    monkeypatch.setattr(s, "langfuse_public_key", "pk-test")
    monkeypatch.setattr(s, "langfuse_secret_key", "sk-test")
    tracing._project_cache.clear()
    sent: dict = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent.setdefault("batches", []).append(json["batch"])
        return httpx.Response(207, json={"successes": [], "errors": []}, request=httpx.Request("POST", url))

    def fake_get(url, headers=None, timeout=None):
        return httpx.Response(200, json={"data": [{"id": "proj123"}]}, request=httpx.Request("GET", url))

    monkeypatch.setattr(tracing.httpx, "post", fake_post)
    monkeypatch.setattr(tracing.httpx, "get", fake_get)
    submit(client, citizen, "Frequent power cuts in Station Road; the transformer keeps tripping since 3 days.")
    batch = next(b for b in sent["batches"] if b[0]["body"]["name"] == "grievance_pipeline")
    assert batch[0]["type"] == "trace-create" and batch[0]["body"]["public"] is True
    spans = [e["body"] for e in batch[1:]]
    assert {sp["name"] for sp in spans} >= {"intake", "policy", "rag", "duplicate", "predictive", "actions"}
    assert all(sp["startTime"] and sp["endTime"] for sp in spans)
    assert any(sp["output"].get("reasoning") for sp in spans)
    trace = db.scalar(select(AgentTrace).where(AgentTrace.name == "grievance_pipeline").order_by(AgentTrace.id.desc()))
    assert trace.langfuse_url.endswith(f"/project/proj123/traces/{trace.trace_id}")


def test_langfuse_url_never_fabricated_when_auth_fails(monkeypatch, db):
    s = get_settings()
    monkeypatch.setattr(s, "langfuse_public_key", "pk-bad")
    monkeypatch.setattr(s, "langfuse_secret_key", "sk-bad")
    tracing._project_cache.clear()
    monkeypatch.setattr(tracing.httpx, "get", lambda url, headers=None, timeout=None: httpx.Response(401, request=httpx.Request("GET", url)))
    assert tracing.langfuse_check()["ok"] is False
    monkeypatch.setattr(tracing.httpx, "post", lambda url, json=None, headers=None, timeout=None: httpx.Response(401, json={}, request=httpx.Request("POST", url)))
    out = tracing.Tracer(db, "unit_test").finish()
    assert out.langfuse_url is None
    db.rollback()


def test_mock_receiver_verifies_signatures(client, admin):
    body = json.dumps({"event": "grievance.created", "data": {"grievance_id": "GRV-X"}}).encode()
    good = "sha256=" + hmac.new(get_settings().webhook_signing_secret.encode(), body, hashlib.sha256).hexdigest()
    r = client.post("/api/v1/mock/webhook-receiver", content=body, headers={"X-Grievance-Signature": good, "X-Grievance-Event": "grievance.created"})
    assert r.json()["signature_valid"] is True
    r = client.post("/api/v1/mock/webhook-receiver", content=body, headers={"X-Grievance-Signature": "sha256=forged"})
    assert r.json()["signature_valid"] is False
    got = client.get("/api/v1/mock/webhook-receiver", headers=admin).json()
    assert got["items"][0]["signature_valid"] is False and got["items"][1]["signature_valid"] is True
    assert client.get("/api/v1/mock/webhook-receiver").status_code == 401


def test_webhook_test_event_reports_delivery_result(client, admin):
    hid = client.post("/api/v1/admin/webhooks", headers=admin, json={"name": "dead", "url": "http://127.0.0.1:9/x", "events": []}).json()["id"]
    r = client.post(f"/api/v1/admin/webhooks/{hid}/test", headers=admin).json()
    assert r["status"] in ("pending", "failed") and r["error"]


def test_registration_honeypot_blocks_bots(client):
    r = client.post("/api/v1/auth/register", json={"email": "bot@test.example.org", "full_name": "Bot", "password": "Passw0rd!x",
                                                   "website": "http://spam.example"})
    assert r.status_code == 400


def test_daily_submission_cap(monkeypatch, client):
    monkeypatch.setattr(get_settings(), "max_grievances_per_day", 1)
    h = new_citizen(client)
    submit(client, h, "Huge potholes on the main road at Market Yard, vehicles are getting damaged.")
    token = client.post("/api/v1/citizen/intake/analyze", json={"text": "Another pothole near Market Yard is very dangerous."}, headers=h).json()["draft_token"]
    r = client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": True}, headers=h)
    assert r.status_code == 429 and r.json()["error"] == "rate_limited"


def test_pageview_analytics_is_anonymous_and_admin_only(client, admin):
    ok = client.post("/api/v1/meta/pageview", content=json.dumps({"path": "/citizen/grievances/:id"}), headers={"Content-Type": "text/plain"})
    assert ok.status_code == 204
    client.post("/api/v1/meta/pageview", content=json.dumps({"path": "<script>"}), headers={"Content-Type": "text/plain"})
    data = client.get("/api/v1/analytics/pageviews", headers=admin).json()
    paths = [p["path"] for p in data["top_pages"]]
    assert "/citizen/grievances/:id" in paths and "<script>" not in paths
    assert client.get("/api/v1/analytics/pageviews").status_code == 401


def test_security_headers_and_csp(client):
    r = client.get("/api/v1/meta/categories")
    assert r.headers["content-security-policy"].startswith("default-src 'none'")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "jsdelivr" in client.get("/api/v1/docs").headers["content-security-policy"]


def test_https_enforced_when_enabled(monkeypatch, client):
    monkeypatch.setattr(get_settings(), "enforce_https", True)
    r = client.get("/api/v1/meta/categories", headers={"X-Forwarded-Proto": "http"}, follow_redirects=False)
    assert r.status_code == 308 and r.headers["location"].startswith("https://")
    r = client.get("/api/v1/meta/categories", headers={"X-Forwarded-Proto": "https"})
    assert "max-age" in r.headers["strict-transport-security"]
