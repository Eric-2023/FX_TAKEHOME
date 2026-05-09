"""Prometheus metrics — standalone module, no imports from routes or services."""
from prometheus_client import Counter, Gauge

QUOTES_GENERATED = Counter(
    "fx_quotes_generated_total",
    "Total number of FX quotes generated",
)
QUOTES_EXECUTED = Counter(
    "fx_quotes_executed_total",
    "Total number of FX quotes executed",
)
IDEMPOTENT_HITS = Counter(
    "fx_idempotent_hits_total",
    "Total number of idempotency cache hits",
)
RATE_REFRESHES = Counter(
    "fx_rate_refreshes_total",
    "Total number of successful rate refreshes",
)
RATE_REFRESH_FAILURES = Counter(
    "fx_rate_refresh_failures_total",
    "Total number of rate refresh failures",
)
RATES_STALE = Gauge(
    "fx_rates_stale",
    "1 if rates are stale (older than 1 hour), 0 otherwise",
)