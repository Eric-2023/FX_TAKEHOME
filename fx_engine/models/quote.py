"""Quote ORM model."""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from typing import Optional


class Quote(Base):
    """
    Maps to the 'quotes' table.
    A locked-in FX price valid for 60 seconds.
    Rate is guaranteed at execution — stored here, never re-fetched.
    """
    __tablename__ = "quotes"

    id:            Mapped[str]            = mapped_column(String, primary_key=True)
    customer_id:   Mapped[str]            = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    from_currency: Mapped[str]            = mapped_column(String(3), nullable=False)
    to_currency:   Mapped[str]            = mapped_column(String(3), nullable=False)
    amount:        Mapped[Decimal]        = mapped_column(Numeric(20, 6), nullable=False)
    rate:          Mapped[Decimal]        = mapped_column(Numeric(20, 10), nullable=False)
    final_amount:  Mapped[Decimal]        = mapped_column(Numeric(20, 2), nullable=False)
    created_at:    Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at:    Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    executed:      Mapped[bool]           = mapped_column(Boolean, nullable=False, default=False)
    executed_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer:    Mapped["Customer"]         = relationship(back_populates="quotes")
    transaction: Mapped["Transaction|None"] = relationship(back_populates="quote", uselist=False)

    def to_dict(self) -> dict:
        return {
            "quote_id": self.id,
            "customer_id": self.customer_id,
            "from_currency": self.from_currency,
            "to_currency": self.to_currency,
            "amount": str(self.amount),
            "rate": str(self.rate),
            "final_amount": str(self.final_amount),
            "expires_at": self.expires_at.isoformat(),
        }