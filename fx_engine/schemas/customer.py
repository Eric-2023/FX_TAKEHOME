"""Customer request and response schemas."""
from __future__ import annotations
from decimal import Decimal
from typing import Dict
from pydantic import BaseModel, field_validator


class CustomerRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()


class CustomerResponse(BaseModel):
    customer_id: str
    name: str
    created_at: str


class BalanceResponse(BaseModel):
    customer_id: str
    balances: Dict[str, str]


class CreditRequest(BaseModel):
    currency: str
    amount: Decimal

    @field_validator("currency")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        return v.upper()

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v