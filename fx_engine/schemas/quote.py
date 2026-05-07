"""Quote request and response schemas."""
from __future__ import annotations
from decimal import Decimal
from pydantic import BaseModel, field_validator


class QuoteRequest(BaseModel):
    customer_id: str
    from_currency: str
    to_currency: str
    amount: Decimal

    @field_validator("from_currency", "to_currency")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.upper()

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class QuoteResponse(BaseModel):
    quote_id: str
    customer_id: str
    from_currency: str
    to_currency: str
    amount: str
    rate: str
    final_amount: str
    expires_at: str