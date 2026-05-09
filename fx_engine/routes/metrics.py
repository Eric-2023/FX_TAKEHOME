"""Metrics route — GET /metrics (Prometheus format)."""
from __future__ import annotations
from fastapi import APIRouter, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST


def create_metrics_router() -> APIRouter:
    router = APIRouter(tags=["metrics"])

    @router.get("/metrics", include_in_schema=False)
    def metrics():
        """Prometheus metrics endpoint."""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )

    return router