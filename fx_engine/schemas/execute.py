"""Execute request and response schemas."""
from __future__ import annotations
from pydantic import BaseModel


class ExecuteRequest(BaseModel):
    customer_id: str


class ExecuteResponse(BaseModel):
    transaction_id: str
    quote_id: str
    customer_id: str
    from_currency: str
    to_currency: str
    amount: str
    final_amount: str
    rate: str
    executed_at: str