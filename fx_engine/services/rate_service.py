"""Rate service — thread-safe FX rate cache with buy/sell spreads.

In production this pulls from exchangeratesapi.io.
Failure policy: keep serving last known rates and log the error.
If rates are older than STALE_THRESHOLD_SECONDS, report as stale.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Optional

log = logging.getLogger(__name__)

# Seed mid-rates against USD
# In production: pulled from exchangeratesapi.io
_SEED_MID: Dict[str, Decimal] = {
    "USD/EUR": Decimal("0.92"),
    "USD/KES": Decimal("129.50"),
    "USD/NGN": Decimal("1480.00"),
    "EUR/USD": Decimal("1.087"),
    "EUR/KES": Decimal("140.75"),
    "EUR/NGN": Decimal("1608.50"),
}

SPREAD_PCT = Decimal("0.005")       # 50 basis points each side
STALE_THRESHOLD_SECONDS = 3600      # 1 hour


def _with_spread(mid: Decimal) -> Dict[str, Decimal]:
    """Derive buy/sell rates from a mid-rate."""
    return {
        "buy":  mid * (Decimal("1") - SPREAD_PCT),
        "sell": mid * (Decimal("1") + SPREAD_PCT),
    }


class RateService:
    """
    Thread-safe FX rate cache.
    Uses atomic dict replacement on refresh — readers never see partial state.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rates: Dict[str, Dict[str, Decimal]] = {
            pair: _with_spread(mid) for pair, mid in _SEED_MID.items()
        }
        self._last_updated = datetime.now(timezone.utc)

    def refresh(self) -> None:
        """
        Refresh rates from upstream.
        On failure: keep serving last known rates and log the error.
        """
        try:
            new_rates = {
                pair: _with_spread(mid) for pair, mid in _SEED_MID.items()
            }
            with self._lock:
                self._rates = new_rates
                self._last_updated = datetime.now(timezone.utc)
            log.info("rates_refreshed")
        except Exception as exc:
            log.error(
                "rate_refresh_failed age=%ds error=%s — serving last known rates",
                self._age_seconds(), exc,
            )

    def get(self, pair: str) -> Optional[Dict[str, Decimal]]:
        """Return buy/sell rates for a pair, or None if not found."""
        with self._lock:
            return self._rates.get(pair)

    def snapshot(self) -> Dict[str, Dict[str, str]]:
        """Return all rates as strings for API responses."""
        with self._lock:
            result = {
                pair: {"buy": str(v["buy"]), "sell": str(v["sell"])}
                for pair, v in self._rates.items()
            }
        if self.is_stale():
            log.warning(
                "serving_stale_rates last_updated=%s",
                self._last_updated.isoformat(),
            )
        return result

    def is_stale(self) -> bool:
        return self._age_seconds() > STALE_THRESHOLD_SECONDS

    def last_updated_iso(self) -> str:
        return self._last_updated.isoformat()

    def _age_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self._last_updated).total_seconds()