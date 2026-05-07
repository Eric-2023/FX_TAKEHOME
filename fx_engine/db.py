"""
Database connection and session management.

Uses SQLAlchemy ORM with:
- Connection pooling (handled by SQLAlchemy engine)
- Session-per-request pattern via context manager
- Auto commit on success, rollback on any exception
- Alembic for schema migrations

All models inherit from Base — SQLAlchemy tracks table definitions there.
db.py only manages connections and sessions, not schema.
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from models.base import Base

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fx_user:fx_pass@localhost:5435/fx_engine"
)

# Engine — connection pool managed by SQLAlchemy
# pool_pre_ping=True checks connections before using them
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,  # Set True to log all SQL — useful for debugging
)

# Session factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy session with auto commit/rollback.

    Usage:
        with get_db() as session:
            customer = session.query(Customer).filter_by(id=id).first()
            session.add(new_record)
        # commits automatically on exit
        # rolls back automatically on exception
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """
    Create all tables from ORM model definitions.
    Called on startup — safe to run multiple times (CREATE IF NOT EXISTS).

    In production: use Alembic migrations instead.
    alembic upgrade head
    """
    Base.metadata.create_all(bind=engine)
    log.info("database_initialised")


def reset_db() -> None:
    """Drop all tables and recreate. Tests only."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    log.info("database_reset")