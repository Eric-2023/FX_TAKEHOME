"""FX service — quote generation, execution, and rate routing.

Uses SQLAlchemy ORM for all database operations.
All financial calculations use Decimal — no float at any stage.

Concurrency: with_for_update() on quote row — DB row-level locking.
             Works correctly across multiple workers/processes.
Atomicity:   All writes in a single session — commit or rollback together.
Idempotency: Check and write atomically within the same session.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, update

from db import get_db
from models import Customer, Balance, Quote, Transaction, Idempotency
from services.rate_service import RateService
from utils.decimal_utils import quantize, to_decimal

log = logging.getLogger(__name__)

QUOTE_TTL_SECONDS = 60
SUPPORTED_CURRENCIES = {"USD", "EUR", "KES", "NGN"}


class FXService:
    """
    Core FX business logic.

    Depends on RateService for exchange rates.
    Uses SQLAlchemy sessions for all persistence.
    No HTTP knowledge — that lives in routes/.
    """

    def __init__(self, rate_service: RateService) -> None:
        self.rates = rate_service

    # ── Customer operations ──────────────────────────────────────────

    def create_customer(self, name: str, cid: str = "-") -> Customer:
        """Create a customer with zero balances in all supported currencies."""
        if not name or not name.strip():
            raise ValueError("name is required")

        customer = Customer(
            id=str(uuid.uuid4()),
            name=name.strip(),
            created_at=datetime.now(timezone.utc),
        )

        with get_db() as session:
            session.add(customer)
            session.flush()

            for currency in SUPPORTED_CURRENCIES:
                balance = Balance(
                    customer_id=customer.id,
                    currency=currency,
                    amount=Decimal("0.00"),
                )
                session.add(balance)

            # Refresh loads all attributes while session is still open
            session.refresh(customer)
            # Expunge detaches object so it can be used after session closes
            session.expunge(customer)

        log.info("customer_created id=%s cid=%s", customer.id, cid)
        return customer

    def get_balances(self, customer_id: str) -> dict:
        """Return all currency balances for a customer."""
        with get_db() as session:
            balances = (
                session.query(Balance)
                .filter(Balance.customer_id == customer_id)
                .all()
            )
            if not balances:
                raise ValueError(f"customer {customer_id} not found")
            # Build dict inside session while objects are still attached
            return {b.currency: str(b.amount) for b in balances}

    def credit_balance(
        self,
        customer_id: str,
        currency: str,
        amount: Decimal,
        cid: str = "-",
    ) -> None:
        """
        Credit a customer balance.
        Test fixture only — not a production operation.
        """
        if currency not in SUPPORTED_CURRENCIES:
            raise ValueError(f"unsupported currency: {currency}")
        if amount <= 0:
            raise ValueError("amount must be positive")

        with get_db() as session:
            balance = (
                session.query(Balance)
                .filter(
                    Balance.customer_id == customer_id,
                    Balance.currency == currency,
                )
                .first()
            )
            if balance is None:
                raise ValueError(
                    f"customer {customer_id} or currency {currency} not found"
                )
            balance.amount += amount

        log.info(
            "balance_credited customer=%s currency=%s amount=%s cid=%s",
            customer_id, currency, amount, cid,
        )

    # ── Quote operations ─────────────────────────────────────────────

    def generate_quote(
        self,
        customer_id: str,
        from_ccy: str,
        to_ccy: str,
        amount: Decimal,
        cid: str = "-",
    ) -> Quote:
        """
        Generate a locked-in FX quote valid for 60 seconds.
        Rate is fixed at generation — honoured at execution.
        """
        if amount <= 0:
            raise ValueError("amount must be positive")
        if from_ccy == to_ccy:
            raise ValueError("from and to currencies must differ")
        if from_ccy not in SUPPORTED_CURRENCIES:
            raise ValueError(f"unsupported currency: {from_ccy}")
        if to_ccy not in SUPPORTED_CURRENCIES:
            raise ValueError(f"unsupported currency: {to_ccy}")

        # Pure Decimal arithmetic — quantize only at final step
        rate = self._effective_rate(from_ccy, to_ccy)
        final_amount = quantize(amount * rate)
        if final_amount <= 0:
            raise ValueError(
                f"amount too small — {amount} {from_ccy} converts to less than "
                f"one minor unit in {to_ccy}"
            )

        now = datetime.now(timezone.utc)
        quote = Quote(
            id=str(uuid.uuid4()),
            customer_id=customer_id,
            from_currency=from_ccy,
            to_currency=to_ccy,
            amount=amount,
            rate=rate,
            final_amount=final_amount,
            created_at=now,
            expires_at=now + timedelta(seconds=QUOTE_TTL_SECONDS),
            executed=False,
        )

        with get_db() as session:
            session.add(quote)
            session.flush()
            session.refresh(quote)
            session.expunge(quote)

        log.info(
            "quote_generated quote_id=%s customer=%s %s->%s "
            "amount=%s rate=%s final=%s cid=%s",
            quote.id, customer_id, from_ccy, to_ccy,
            amount, rate, final_amount, cid,
        )
        return quote

    def execute_quote(
        self,
        quote_id: str,
        customer_id: str,
        idempotency_key: Optional[str] = None,
        cid: str = "-",
    ) -> dict:
        """
        Execute a quote: debit source balance, credit destination balance.

        All steps run in a single SQLAlchemy session (one DB transaction):
        1. Idempotency check
        2. with_for_update() — row-level lock on quote
        3. Validation (expired, wrong customer, already executed)
        4. Mark executed
        5. Debit source balance (with sufficiency check)
        6. Credit destination balance
        7. Create transaction record
        8. Write idempotency cache

        Rollback on any failure — nothing is half-done.
        with_for_update() works correctly across multiple workers.
        """
        with get_db() as session:

            # ── Step 1: Idempotency check ────────────────────────────
            if idempotency_key:
                cached = (
                    session.query(Idempotency)
                    .filter(Idempotency.key == idempotency_key)
                    .first()
                )
                if cached:
                    log.info(
                        "idempotent_hit key=%s cid=%s", idempotency_key, cid
                    )
                    return json.loads(cached.response)

            # ── Step 2: Lock quote row for update ────────────────────
            quote = (
                session.query(Quote)
                .filter(Quote.id == quote_id)
                .with_for_update()
                .first()
            )

            # ── Step 3: Validate ─────────────────────────────────────
            if quote is None:
                raise ValueError("quote not found")
            if quote.customer_id != customer_id:
                raise ValueError("quote does not belong to this customer")
            if quote.expires_at < datetime.now(timezone.utc):
                raise ValueError("quote expired")
            if quote.executed:
                raise ValueError("quote already executed")

            # ── Step 4: Mark executed ────────────────────────────────
            now = datetime.now(timezone.utc)
            quote.executed = True
            quote.executed_at = now

            # ── Step 5: Use quoted rate — never re-fetch ─────────────
            rate = quote.rate
            amount = quote.amount
            final_amount = quantize(amount * rate)
            from_ccy = quote.from_currency
            to_ccy = quote.to_currency

            # ── Step 6: Debit source balance ─────────────────────────
            source_balance = (
                session.query(Balance)
                .filter(
                    Balance.customer_id == customer_id,
                    Balance.currency == from_ccy,
                )
                .with_for_update()
                .first()
            )
            if source_balance is None or source_balance.amount < amount:
                raise ValueError(f"insufficient {from_ccy} balance")
            source_balance.amount -= amount

            # ── Step 7: Credit destination balance ───────────────────
            dest_balance = (
                session.query(Balance)
                .filter(
                    Balance.customer_id == customer_id,
                    Balance.currency == to_ccy,
                )
                .with_for_update()
                .first()
            )
            if dest_balance is None:
                raise ValueError(f"balance record not found for {to_ccy}")
            dest_balance.amount += final_amount

            # ── Step 8: Create transaction record ────────────────────
            tx_id = str(uuid.uuid4())
            transaction = Transaction(
                id=tx_id,
                quote_id=quote_id,
                customer_id=customer_id,
                from_currency=from_ccy,
                to_currency=to_ccy,
                amount=amount,
                final_amount=final_amount,
                rate=rate,
                executed_at=now,
            )
            session.add(transaction)

            # ── Step 9: Write idempotency cache ───────────────────────
            response = transaction.to_dict()

            if idempotency_key:
                idem = Idempotency(
                    key=idempotency_key,
                    response=json.dumps(response),
                    created_at=now,
                )
                session.merge(idem)

        log.info(
            "quote_executed tx_id=%s quote_id=%s customer=%s "
            "%s->%s amount=%s final=%s cid=%s",
            tx_id, quote_id, customer_id,
            from_ccy, to_ccy, amount, final_amount, cid,
        )
        return response

    # ── Rate routing ─────────────────────────────────────────────────

    def _effective_rate(self, from_ccy: str, to_ccy: str) -> Decimal:
        """
        Return the effective sell rate for a currency pair.

        Lookup order:
        1. Direct pair  (from_ccy/to_ccy)  → sell rate
        2. Inverse pair (to_ccy/from_ccy)  → invert buy rate
        3. Cross via USD → leg1 * leg2

        Spread direction:
        - Direct: bank sells to_ccy → sell rate
        - Inverse: bank buys from_ccy → buy rate, then invert
        - Cross: spreads compound across both legs (documented in SPEC.md)
        """
        direct = self.rates.get(f"{from_ccy}/{to_ccy}")
        if direct is not None:
            return direct["sell"]

        inverse = self.rates.get(f"{to_ccy}/{from_ccy}")
        if inverse is not None:
            return Decimal("1") / inverse["buy"]

        leg1 = self._to_usd(from_ccy)
        leg2 = self._from_usd(to_ccy)
        if leg1 is not None and leg2 is not None:
            return leg1 * leg2

        raise ValueError(f"no rate path available for {from_ccy}/{to_ccy}")

    def _to_usd(self, from_ccy: str) -> Optional[Decimal]:
        if from_ccy == "USD":
            return Decimal("1")
        direct = self.rates.get(f"{from_ccy}/USD")
        if direct:
            return direct["sell"]
        inverse = self.rates.get(f"USD/{from_ccy}")
        if inverse:
            return Decimal("1") / inverse["buy"]
        return None

    def _from_usd(self, to_ccy: str) -> Optional[Decimal]:
        if to_ccy == "USD":
            return Decimal("1")
        direct = self.rates.get(f"USD/{to_ccy}")
        if direct:
            return direct["sell"]
        inverse = self.rates.get(f"{to_ccy}/USD")
        if inverse:
            return Decimal("1") / inverse["buy"]
        return None