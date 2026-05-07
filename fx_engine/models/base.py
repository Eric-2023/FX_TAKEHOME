"""SQLAlchemy declarative base — shared by all models."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Base class for all ORM models.
    All models inherit from this — SQLAlchemy uses it to track
    all table definitions and generate schema.
    """
    pass