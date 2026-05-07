"""Balance ORM model."""
from __future__ import annotations
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Balance(Base):
    """
    Maps to the 'balances' table.
    One row per (customer, currency) pair.
    NUMERIC(20, 6) — exact decimal storage, no float arithmetic.
    """
    __tablename__ = "balances"
    __table_args__ = (
        UniqueConstraint("customer_id", "currency", name="uq_balance_customer_currency"),
    )

    id:          Mapped[int]     = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[str]     = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    currency:    Mapped[str]     = mapped_column(String(3), nullable=False)
    amount:      Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False, default=Decimal("0.00"))

    # Relationship back to customer
    customer: Mapped["Customer"] = relationship(back_populates="balances")

    def to_dict(self) -> dict:
        return {
            "customer_id": self.customer_id,
            "currency": self.currency,
            "amount": str(self.amount),
        }