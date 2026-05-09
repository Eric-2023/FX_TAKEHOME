"""Transaction routes — /transactions."""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException
from typing import Optional
from services.fx_service import FXService

log = logging.getLogger(__name__)


def create_transactions_router(fx_service: FXService) -> APIRouter:
    router = APIRouter(prefix="/transactions", tags=["transactions"])

    @router.get("")
    def list_transactions(customer_id: Optional[str] = None):
        """List all transactions, optionally filtered by customer_id."""
        try:
            transactions = fx_service.list_transactions(customer_id=customer_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return [t.to_dict() for t in transactions]

    @router.get("/{transaction_id}")
    def get_transaction(transaction_id: str):
        """Get a single transaction by ID."""
        try:
            transaction = fx_service.get_transaction(transaction_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        return transaction.to_dict()

    return router