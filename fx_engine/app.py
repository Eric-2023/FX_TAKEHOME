"""
FastAPI application factory.

Dependency flow (strictly one-way, no circular imports):
  app.py
    → creates RateService
    → creates FXService(rate_service)
    → injects services into router factories
    → registers routers
"""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from db import init_db
from services import FXService, RateService
from routes import (
    create_health_router,
    create_customers_router,
    create_quotes_router,
    create_rates_router,
    create_metrics_router,
)

# ── Logging — terminal + file ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.StreamHandler(),                    # terminal
        logging.FileHandler("fx_engine.log"),       # file — gitignored
    ]
)
log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Application factory — creates and wires all dependencies."""

    app = FastAPI(
        title="Umba FX Engine",
        description="Production-grade FX engine — FastAPI + PostgreSQL + SQLAlchemy",
        version="1.0.0",
    )

    # ── Create services ──────────────────────────────────────────────
    rate_service = RateService()
    fx_service = FXService(rate_service)

    # ── Register routers ─────────────────────────────────────────────
    app.include_router(create_health_router(rate_service))
    app.include_router(create_customers_router(fx_service))
    app.include_router(create_quotes_router(fx_service))
    app.include_router(create_rates_router(rate_service))
    app.include_router(create_metrics_router())

    # ── Initialise DB on startup ─────────────────────────────────────
    @app.on_event("startup")
    def startup():
        init_db()
        log.info("fx_engine_started")

    # ── Correlation ID middleware ─────────────────────────────────────
    @app.middleware("http")
    async def attach_correlation_id(request: Request, call_next):
        cid = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.cid = cid
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = cid
        return response

    # ── Global exception handler ──────────────────────────────────────
    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        cid = getattr(request.state, "cid", "-")
        log.exception("unhandled_exception cid=%s", cid)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "correlation_id": cid},
        )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)