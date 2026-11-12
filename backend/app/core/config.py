"""Application settings, loaded only from environment variables / backend/.env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "development"
    app_name: str = "GRIEVANCE"

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'grievance.db').as_posix()}"

    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    cors_origins: str = "http://localhost:5173"

    # LLM providers: Groq is primary, Gemini is the fallback, deterministic rules last.
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    llm_timeout_seconds: float = 30.0

    embedding_provider: str = "auto"  # auto | sentence-transformers | hashing
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    stt_provider: str = "auto"  # auto | faster-whisper | disabled
    whisper_model: str = "small"

    default_confidence_threshold: float = 0.70
    duplicate_threshold: float = 0.78
    duplicate_window_days: int = 30
    duplicate_radius_km: float = 1.5
    sla_warning_fraction: float = 0.75
    auto_close_after_days: int = 7
    sla_scan_interval_seconds: int = 300

    langfuse_host: str = "https://cloud.langfuse.com"
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

    webhook_signing_secret: str = "dev-webhook-secret"

    seed_demo_users: bool = True
    demo_password: str = "Demo@12345"
    # Real system administrator created at start-up (set both in backend/.env). When set, the demo
    # administrator account (admin@example.org) is not created and any existing one is deactivated.
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = "System Administrator"

    max_grievances_per_day: int = 10
    max_drafts_per_day: int = 60
    enforce_https: bool = False  # set true behind a TLS-terminating proxy in production

    data_gov_in_api_key: str = ""  # personal key from data.gov.in (optional)

    upload_dir: str = str(BACKEND_DIR / "uploads")
    max_upload_mb: int = 15

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        # Accept plain postgres URLs and route them through psycopg 3.
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key.strip())

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def llm_enabled(self) -> bool:
        return self.groq_enabled or self.gemini_enabled

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
