"""Idempotency ORM model."""
from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class Idempotency(Base):
    """
    Maps to the 'idempotency' table.
    Caches execute responses keyed by client idempotency key.
    Prevents double-execution on client retries.
    """
    __tablename__ = "idempotency"

    key:        Mapped[str]      = mapped_column(String, primary_key=True)
    response:   Mapped[str]      = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )