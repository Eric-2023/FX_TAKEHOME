"""Quote routes — /quotes."""
from __future__ import annotations
import logging
from fastapi import APIRouter, Header, HTTPException, Request
from typing import Optional
from schemas import QuoteRequest, QuoteResponse, ExecuteRequest, ExecuteResponse
from services.fx_service import FXService

log = logging.getLogger(__name__)


def create_quotes_router(fx_service: FXService) -> APIRouter:
    router = APIRouter(prefix="/quotes", tags=["quotes"])

    @router.get("")
    def list_quotes(customer_id: Optional[str] = None):
        """List all quotes, optionally filtered by customer_id."""
        try:
            quotes = fx_service.list_quotes(customer_id=customer_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return [q.to_dict() for q in quotes]

    @router.get("/{quote_id}")
    def get_quote(quote_id: str):
        """Get a single quote by ID."""
        try:
            quote = fx_service.get_quote(quote_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        return quote.to_dict()

    @router.post("", status_code=201, response_model=QuoteResponse)
    def create_quote(body: QuoteRequest, request: Request):
        """
        Generate a locked-in FX quote valid for 60 seconds.
        Rate is guaranteed — honoured at execution regardless of market movement.
        """
        cid = request.state.cid
        try:
            quote = fx_service.generate_quote(
                customer_id=body.customer_id,
                from_ccy=body.from_currency,
                to_ccy=body.to_currency,
                amount=body.amount,
                cid=cid,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return quote.to_dict()

    @router.post("/{quote_id}/execute", response_model=ExecuteResponse)
    def execute_quote(
        quote_id: str,
        body: ExecuteRequest,
        request: Request,
        idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ):
        """
        Execute a quote — debit source, credit destination atomically.
        Optional Idempotency-Key header makes retries safe.
        """
        cid = request.state.cid
        try:
            result = fx_service.execute_quote(
                quote_id=quote_id,
                customer_id=body.customer_id,
                idempotency_key=idempotency_key,
                cid=cid,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return result

    return router