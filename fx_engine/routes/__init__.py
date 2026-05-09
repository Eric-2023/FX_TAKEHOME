"""Routes package — router factories for all endpoints."""

from .health import create_health_router
from .customers import create_customers_router
from .quotes import create_quotes_router
from .rates import create_rates_router
from .metrics import create_metrics_router
from .transactions import create_transactions_router

__all__ = [
    "create_health_router",
    "create_customers_router",
    "create_quotes_router",
    "create_rates_router",
    "create_metrics_router",
    "create_transactions_router",
]