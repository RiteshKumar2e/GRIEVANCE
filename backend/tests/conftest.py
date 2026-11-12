"""Test fixtures. Tests run against a throw-away SQLite database seeded with the SYNTHETIC
datasets, with LLM keys removed (deterministic fallback) and the hashing embedder for speed."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="grievance-test-"))
os.environ.update({
    "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    "GROQ_API_KEY": "",
    "GEMINI_API_KEY": "",
    "EMBEDDING_PROVIDER": "hashing",
    "STT_PROVIDER": "disabled",
    "SLA_SCAN_INTERVAL_SECONDS": "0",
    "LANGFUSE_PUBLIC_KEY": "",
    "LANGFUSE_SECRET_KEY": "",
    "JWT_SECRET": "test-secret-not-for-production-use-0123456789",
    "SEED_DEMO_USERS": "true",
    "BOOTSTRAP_ADMIN_EMAIL": "",  # tests use the demo admin, whatever backend/.env configures
    "BOOTSTRAP_ADMIN_PASSWORD": "",
    "APP_ENV": "test",
})

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from fastapi.testclient import TestClient  # noqa: E402

from app.core.ratelimit import limiter  # noqa: E402
from app.db.session import Base, SessionLocal, configure_engine  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "Demo@12345"


@pytest.fixture(scope="session", autouse=True)
def _database():
    import app.models  # noqa: F401
    from app.services.seed import seed_datasets, seed_users

    engine = configure_engine(get_settings().database_url)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_datasets(db)
        seed_users(db)
    limiter.enabled = False
    yield
    engine.dispose()


@pytest.fixture()
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, email: str, password: str = PASSWORD) -> dict[str, str]:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


_counter = {"n": 0}


def new_citizen(client: TestClient) -> dict[str, str]:
    _counter["n"] += 1
    email = f"citizen{_counter['n']}-{os.getpid()}@test.example.org"
    r = client.post("/api/v1/auth/register", json={"email": email, "full_name": "Test Citizen", "password": "Passw0rd!x"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def submit(client: TestClient, headers: dict, text: str, **edits) -> dict:
    """Analyse + confirm in one go; returns the grievance detail."""
    r = client.post("/api/v1/citizen/intake/analyze", json={"text": text}, headers=headers)
    assert r.status_code == 200, r.text
    token = r.json()["draft_token"]
    r = client.post(f"/api/v1/citizen/intake/{token}/confirm", json={"confirmed": True, **edits}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def citizen(client):
    return new_citizen(client)


@pytest.fixture()
def admin(client):
    return login(client, "admin@example.org")
