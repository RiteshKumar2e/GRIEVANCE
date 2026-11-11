"""GRIEVANCE — FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, analytics, auth, citizen, department, external, meta, mock, observability, officer
from app.core.config import get_settings
from app.core.errors import install_handlers
from app.db.session import SessionLocal, get_engine

log = logging.getLogger("grievance")
API = "/api/v1"


API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
# Swagger/ReDoc pages load their UI from the jsDelivr CDN.
DOCS_CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.redoc.ly; font-src 'self' https://fonts.gstatic.com; "
            "worker-src 'self' blob:; frame-ancestors 'none'")


class SecurityHeaders(BaseHTTPMiddleware):
    """Security headers, optional HTTPS enforcement (behind a TLS proxy) and a strict CSP for API responses."""

    async def dispatch(self, request, call_next):
        s = get_settings()
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if s.enforce_https and proto == "http" and request.url.path != "/health":
            from starlette.responses import RedirectResponse

            return RedirectResponse(str(request.url.replace(scheme="https")), status_code=308)
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
        is_docs = request.url.path.startswith((f"{API}/docs", f"{API}/redoc"))
        resp.headers.setdefault("Content-Security-Policy", DOCS_CSP if is_docs else API_CSP)
        if s.enforce_https:
            resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
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
    for r in (auth.router, meta.router, citizen.router, citizen.notif_router, officer.router, department.router, admin.router,
              analytics.router, observability.router, observability.public_router, mock.router, external.router):
        app.include_router(r, prefix=API)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
