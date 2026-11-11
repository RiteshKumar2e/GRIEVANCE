"""GRIEVANCE — FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, analytics, auth, citizen, meta, observability, officer
from app.core.config import get_settings
from app.core.errors import install_handlers
from app.db.session import SessionLocal, get_engine

log = logging.getLogger("grievance")
API = "/api/v1"


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Cache-Control", "no-store")
        return resp


async def _sla_monitor(interval: int) -> None:
    from app.agents.orchestrator import auto_close, sla_scan
    from app.services.webhooks import deliver_pending

    while True:
        await asyncio.sleep(interval)
        try:
            def job():
                with SessionLocal() as db:
                    sla_scan(db)
                    auto_close(db)
                deliver_pending()

            await asyncio.to_thread(job)
        except Exception:  # never crash the server because of the monitor
            log.exception("SLA monitor iteration failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    get_engine()
    if s.is_production and s.jwt_secret.startswith(("dev-", "change-me")):
        raise RuntimeError("JWT_SECRET must be set to a strong value in production")
    task = asyncio.create_task(_sla_monitor(s.sla_scan_interval_seconds)) if s.sla_scan_interval_seconds > 0 else None
    yield
    if task:
        task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="GRIEVANCE API",
        version="1.0.0",
        description=(
            "Autonomous agentic grievance-redressal platform. Six agents: multilingual intake, policy & safety, "
            "RAG precedents, duplicate grouping, predictive SLA, backend actions. LLM chain: Groq -> Gemini -> "
            "deterministic rules. All demo data is SYNTHETIC."
        ),
        lifespan=lifespan,
        docs_url=f"{API}/docs",
        openapi_url=f"{API}/openapi.json",
        redoc_url=f"{API}/redoc",
    )
    app.add_middleware(SecurityHeaders)
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origin_list, allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
    install_handlers(app)
    for r in (auth.router, meta.router, citizen.router, citizen.notif_router, officer.router, admin.router,
              analytics.router, observability.router, observability.public_router):
        app.include_router(r, prefix=API)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
