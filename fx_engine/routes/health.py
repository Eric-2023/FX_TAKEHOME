"""Health check route — GET /healthz."""
from __future__ import annotations
import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from db import get_db
from services.rate_service import RateService

log = logging.getLogger(__name__)


def create_health_router(rate_service: RateService) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz")
    def healthz():
        """Health check — verifies DB and reports rate staleness."""
        try:
            with get_db() as session:
                session.execute(text("SELECT 1"))
            return {
                "status": "ok",
                "db": "ok",
                "rates_stale": rate_service.is_stale(),
                "rates_last_updated": rate_service.last_updated_iso(),
            }
        except Exception as exc:
            log.error("healthz_failed error=%s", exc)
            return JSONResponse(
                status_code=503,
                content={"status": "degraded", "error": str(exc)},
            )

    return router