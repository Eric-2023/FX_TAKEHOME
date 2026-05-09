"""Customer routes — /customers."""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, Request
from schemas import CustomerRequest, CustomerResponse, BalanceResponse, CreditRequest
from services.fx_service import FXService

log = logging.getLogger(__name__)


def create_customers_router(fx_service: FXService) -> APIRouter:
    router = APIRouter(prefix="/customers", tags=["customers"])

    @router.get("")
    def list_customers():
        """List all customers."""
        try:
            customers = fx_service.list_customers()
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return [c.to_dict() for c in customers]

    @router.get("/{customer_id}", response_model=CustomerResponse)
    def get_customer(customer_id: str):
        """Get a single customer by ID."""
        try:
            customer = fx_service.get_customer(customer_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        return customer.to_dict()

    @router.post("", status_code=201, response_model=CustomerResponse)
    def create_customer(body: CustomerRequest, request: Request):
        """Create a new customer with zero balances in all currencies."""
        cid = request.state.cid
        try:
            customer = fx_service.create_customer(name=body.name, cid=cid)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return customer.to_dict()

    @router.get("/{customer_id}/balances", response_model=BalanceResponse)
    def get_balances(customer_id: str, request: Request):
        """View all currency balances for a customer."""
        cid = request.state.cid
        try:
            balances = fx_service.get_balances(customer_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        log.info("balances_viewed customer=%s cid=%s", customer_id, cid)
        return {"customer_id": customer_id, "balances": balances}

    @router.post("/{customer_id}/credit", status_code=200)
    def credit_balance(
        customer_id: str, body: CreditRequest, request: Request
    ):
        """Credit a customer balance. Test fixture only."""
        cid = request.state.cid
        try:
            fx_service.credit_balance(
                customer_id=customer_id,
                currency=body.currency,
                amount=body.amount,
                cid=cid,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {
            "customer_id": customer_id,
            "currency": body.currency,
            "credited": str(body.amount),
        }

    return router