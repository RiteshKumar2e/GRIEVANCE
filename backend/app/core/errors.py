"""Domain errors and secure exception handlers (no stack traces or internals leak to clients)."""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("grievance.errors")


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class PolicyViolation(DomainError):
    """Raised when an action would break a non-negotiable policy rule."""

    status_code = 409
    code = "policy_violation"


class InvalidTransition(DomainError):
    status_code = 409
    code = "invalid_transition"


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "detail": exc.message, "details": exc.details},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        errors = [
            {"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg", "invalid")}
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"error": "validation_error", "detail": "Invalid input", "fields": errors})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        ref = uuid.uuid4().hex[:12]
        log.exception("Unhandled error ref=%s", ref)
        return JSONResponse(status_code=500, content={"error": "internal_error", "detail": "Something went wrong.", "ref": ref})
