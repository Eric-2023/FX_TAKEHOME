"""Rate service — thread-safe FX rate cache with buy/sell spreads.

Pulls from exchangeratesapi.io on refresh (EUR base, free tier).
Failure policy: keep serving last known rates and log the error.
If rates are older than STALE_THRESHOLD_SECONDS, report as stale.
"""
from __future__ import annotations

import logging
import os
import threading
import urllib.request
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Optional

from dotenv import load_dotenv
from metrics import RATE_REFRESHES, RATE_REFRESH_FAILURES, RATES_STALE

load_dotenv()

log = logging.getLogger(__name__)

API_KEY = os.getenv("EXCHANGERATES_API_KEY", "")
RATES_API_URL = (
    f"http://api.exchangeratesapi.io/v1/latest"
    f"?access_key={API_KEY}&base=EUR&symbols=USD,KES,NGN,EUR"
)

# Fallback seed rates (used on startup if live fetch fails)
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

SUPPORTED = {"USD", "EUR", "KES", "NGN"}


def _with_spread(mid: Decimal) -> Dict[str, Decimal]:
    return {
        "buy":  mid * (Decimal("1") - SPREAD_PCT),
        "sell": mid * (Decimal("1") + SPREAD_PCT),
    }


def _build_rates(mid_map: Dict[str, Decimal]) -> Dict[str, Dict[str, Decimal]]:
    """Build full rates dict from mid-rates."""
    return {pair: _with_spread(mid) for pair, mid in mid_map.items()}


def _fetch_live_mids() -> Dict[str, Decimal]:
    """
    Fetch live mid-rates from exchangeratesapi.io (EUR base, free tier).
    Derives all required pairs from EUR base rates.
    Raises on any network or parse error.
    """
    if not API_KEY:
        raise ValueError("EXCHANGERATES_API_KEY not set — using seed rates")

    with urllib.request.urlopen(RATES_API_URL, timeout=5) as resp:
        data = json.loads(resp.read().decode())

    if not data.get("success"):
        raise ValueError(f"API returned non-success: {data}")

    r = data["rates"]  # EUR-based rates
    eur_usd = Decimal(str(r["USD"]))
    eur_kes = Decimal(str(r["KES"]))
    eur_ngn = Decimal(str(r["NGN"]))

    # Derive USD-based mids via EUR cross
    usd_kes = eur_kes / eur_usd
    usd_ngn = eur_ngn / eur_usd

    mids: Dict[str, Decimal] = {
        # EUR pairs
        "EUR/USD": eur_usd,
        "USD/EUR": Decimal("1") / eur_usd,
        "EUR/KES": eur_kes,
        "KES/EUR": Decimal("1") / eur_kes,
        "EUR/NGN": eur_ngn,
        "NGN/EUR": Decimal("1") / eur_ngn,
        # USD pairs
        "USD/KES": usd_kes,
        "KES/USD": Decimal("1") / usd_kes,
        "USD/NGN": usd_ngn,
        "NGN/USD": Decimal("1") / usd_ngn,
        # KES/NGN cross
        "KES/NGN": eur_ngn / eur_kes,
        "NGN/KES": eur_kes / eur_ngn,
    }
    return mids


class RateService:
    """
    Thread-safe FX rate cache.
    Uses atomic dict replacement on refresh — readers never see partial state.
    Seeded with fallback rates on startup, then attempts live fetch immediately.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        # Start with seed rates in case live fetch fails
        self._rates = _build_rates(_SEED_MID)
        self._last_updated = datetime.now(timezone.utc)
        # Attempt live fetch immediately on startup
        self.refresh()

    def refresh(self) -> None:
        """
        Refresh rates from upstream.
        On failure: keep serving last known rates and log the error.
        """
        try:
            live_mids = _fetch_live_mids()
            new_rates = _build_rates(live_mids)
            with self._lock:
                self._rates = new_rates
                self._last_updated = datetime.now(timezone.utc)
            log.info(
                "rates_refreshed source=exchangeratesapi.io pairs=%d",
                len(new_rates),
            )
            RATE_REFRESHES.inc()
            RATES_STALE.set(0)
        except Exception as exc:
            log.error(
                "rate_refresh_failed age=%ds error=%s — serving last known rates",
                self._age_seconds(), exc,
            )
            RATE_REFRESH_FAILURES.inc()
            RATES_STALE.set(1 if self.is_stale() else 0)

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