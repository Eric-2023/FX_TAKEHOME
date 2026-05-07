"""Transaction ORM model."""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Numeric, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Transaction(Base):
    """
    Maps to the 'transactions' table.
    Permanent record of a completed FX execution.
    Created atomically with balance updates — never exists without them.
    One transaction per quote (UniqueConstraint on quote_id).
    """
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("quote_id", name="uq_transaction_quote"),
    )

    id:            Mapped[str]     = mapped_column(String, primary_key=True)
    quote_id:      Mapped[str]     = mapped_column(String, ForeignKey("quotes.id"), nullable=False, unique=True)
    customer_id:   Mapped[str]     = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    from_currency: Mapped[str]     = mapped_column(String(3), nullable=False)
    to_currency:   Mapped[str]     = mapped_column(String(3), nullable=False)
    amount:        Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    final_amount:  Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    rate:          Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    executed_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    quote:    Mapped["Quote"]    = relationship(back_populates="transaction")
    customer: Mapped["Customer"] = relationship(back_populates="transactions")

    def to_dict(self) -> dict:
        return {
            "transaction_id": self.id,
            "quote_id": self.quote_id,
            "customer_id": self.customer_id,
            "from_currency": self.from_currency,
            "to_currency": self.to_currency,
            "amount": str(self.amount),
            "final_amount": str(self.final_amount),
            "rate": str(self.rate),
            "executed_at": self.executed_at.isoformat(),
        }