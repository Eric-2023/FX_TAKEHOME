"""Customer ORM model."""
from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Customer(Base):
    """
    Maps to the 'customers' table.
    A customer has balances in multiple currencies and can generate quotes.
    """
    __tablename__ = "customers"

    id:         Mapped[str]      = mapped_column(String, primary_key=True)
    name:       Mapped[str]      = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships — SQLAlchemy handles the joins
    balances:     Mapped[list["Balance"]]     = relationship(back_populates="customer", cascade="all, delete-orphan")
    quotes:       Mapped[list["Quote"]]       = relationship(back_populates="customer")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="customer")

    def to_dict(self) -> dict:
        return {
            "customer_id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
        }