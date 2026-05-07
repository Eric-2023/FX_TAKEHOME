"""Rate routes — /rates."""
from __future__ import annotations
import logging
from fastapi import APIRouter, Request
from services.rate_service import RateService

log = logging.getLogger(__name__)


def create_rates_router(rate_service: RateService) -> APIRouter:
    router = APIRouter(prefix="/rates", tags=["rates"])

    @router.get("")
    def get_rates():
        """View current buy/sell rates for all supported pairs."""
        return {
            "rates": rate_service.snapshot(),
            "last_updated": rate_service.last_updated_iso(),
            "stale": rate_service.is_stale(),
        }

    @router.post("/refresh")
    def refresh_rates(request: Request):
        """
        Refresh rates from upstream source.
        On failure: keeps serving last known rates — see SPEC.md.
        """
        cid = request.state.cid
        rate_service.refresh()
        log.info("rates_refreshed cid=%s", cid)
        return {"status": "ok", "updated_at": rate_service.last_updated_iso()}

    return router