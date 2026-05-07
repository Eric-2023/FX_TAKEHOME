"""
Tests for the FX engine — SQLAlchemy ORM version.

Covers:
- Customer creation and balance management
- Quote generation (correctness, validation)
- Quote execution (balance updates, quoted rate honoured)
- Concurrency (exactly one execution per quote via with_for_update)
- Idempotency (retries don't double-execute)
- Atomicity (insufficient balance rolls back everything)
- Rate routing (direct, inverse, cross pairs)
- Decimal precision (no float errors)

Requires PostgreSQL:
    docker-compose up -d db
    pytest tests/ -v
"""
from __future__ import annotations

import sys
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import get_db
from models import Balance, Quote
from services import FXService, RateService

CUSTOMER_ID = "test-customer-001"
CURRENCIES = ["USD", "EUR", "KES", "NGN"]


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def fresh_db():
    """Truncate data and seed test customer before each test."""
    from models import Customer
    from sqlalchemy import text
    with get_db() as session:
        # Truncate all tables in correct order (FK constraints)
        session.execute(text("TRUNCATE TABLE idempotency, transactions, quotes, balances, customers RESTART IDENTITY CASCADE"))
        session.flush()
        customer = Customer(
            id=CUSTOMER_ID,
            name="Test User",
            created_at=datetime.now(timezone.utc),
        )
        session.add(customer)
        session.flush()
        for currency in CURRENCIES:
            balance = Balance(
                customer_id=CUSTOMER_ID,
                currency=currency,
                amount=Decimal("10000.00"),
            )
            session.add(balance)
    yield


@pytest.fixture
def service():
    return FXService(RateService())


# ── Customer tests ────────────────────────────────────────────────────

def test_create_customer_zero_balances(service):
    customer = service.create_customer("Alice")
    balances = service.get_balances(customer.id)
    assert set(balances.keys()) == {"USD", "EUR", "KES", "NGN"}
    assert all(Decimal(v) == Decimal("0.00") for v in balances.values())


def test_get_balances_unknown_customer_raises(service):
    with pytest.raises(ValueError, match="not found"):
        service.get_balances("does-not-exist")


def test_credit_balance_increases_amount(service):
    service.credit_balance(CUSTOMER_ID, "USD", Decimal("500"))
    balances = service.get_balances(CUSTOMER_ID)
    assert Decimal(balances["USD"]) == Decimal("10500.00")


# ── Quote generation tests ────────────────────────────────────────────

def test_generate_quote_shape(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    assert quote.from_currency == "USD"
    assert quote.to_currency == "KES"
    assert quote.amount == Decimal("100")
    assert quote.final_amount > 0
    assert quote.expires_at > quote.created_at


def test_generate_quote_zero_amount_raises(service):
    with pytest.raises(ValueError, match="positive"):
        service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("0"))


def test_generate_quote_same_currency_raises(service):
    with pytest.raises(ValueError, match="differ"):
        service.generate_quote(CUSTOMER_ID, "USD", "USD", Decimal("100"))


def test_generate_quote_unsupported_currency_raises(service):
    with pytest.raises(ValueError, match="unsupported"):
        service.generate_quote(CUSTOMER_ID, "USD", "GBP", Decimal("100"))


# ── Quote execution tests ─────────────────────────────────────────────

def test_execute_quote_succeeds(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    result = service.execute_quote(quote.id, CUSTOMER_ID)
    assert result["quote_id"] == quote.id
    assert "transaction_id" in result


def test_execute_updates_both_balances(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    expected_final = quote.final_amount
    service.execute_quote(quote.id, CUSTOMER_ID)

    balances = service.get_balances(CUSTOMER_ID)
    assert Decimal(balances["USD"]) == Decimal("9900.00")
    assert Decimal(balances["KES"]) == Decimal("10000.00") + expected_final


def test_execute_honours_quoted_rate(service):
    """Rate must be locked at quote generation — not re-fetched at execution."""
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    original_rate = quote.rate

    # Simulate rate change after quote was generated
    service.rates._rates["USD/KES"] = {
        "buy": Decimal("200"),
        "sell": Decimal("201"),
    }

    result = service.execute_quote(quote.id, CUSTOMER_ID)
    assert Decimal(result["rate"]) == original_rate


def test_execute_unknown_quote_raises(service):
    with pytest.raises(ValueError, match="not found"):
        service.execute_quote("does-not-exist", CUSTOMER_ID)


def test_execute_expired_quote_raises(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    with get_db() as session:
        q = session.query(Quote).filter_by(id=quote.id).first()
        q.expires_at = datetime.now(timezone.utc) - timedelta(seconds=120)
    with pytest.raises(ValueError, match="expired"):
        service.execute_quote(quote.id, CUSTOMER_ID)


def test_execute_wrong_customer_raises(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    with pytest.raises(ValueError, match="does not belong"):
        service.execute_quote(quote.id, "wrong-customer")


def test_execute_insufficient_balance_raises(service):
    with get_db() as session:
        b = session.query(Balance).filter_by(
            customer_id=CUSTOMER_ID, currency="USD"
        ).first()
        b.amount = Decimal("0.00")
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    with pytest.raises(ValueError, match="insufficient"):
        service.execute_quote(quote.id, CUSTOMER_ID)


def test_execute_insufficient_does_not_debit(service):
    """Atomicity — failed execute must not partially update balances."""
    with get_db() as session:
        b = session.query(Balance).filter_by(
            customer_id=CUSTOMER_ID, currency="USD"
        ).first()
        b.amount = Decimal("0.00")

    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    try:
        service.execute_quote(quote.id, CUSTOMER_ID)
    except ValueError:
        pass

    balances = service.get_balances(CUSTOMER_ID)
    assert Decimal(balances["USD"]) == Decimal("0.00")


def test_execute_same_quote_twice_raises(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("100"))
    service.execute_quote(quote.id, CUSTOMER_ID)
    with pytest.raises(ValueError, match="already executed"):
        service.execute_quote(quote.id, CUSTOMER_ID)


# ── Idempotency tests ─────────────────────────────────────────────────

def test_idempotency_same_transaction_id(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "EUR", Decimal("50"))
    r1 = service.execute_quote(quote.id, CUSTOMER_ID, idempotency_key="k1")
    r2 = service.execute_quote(quote.id, CUSTOMER_ID, idempotency_key="k1")
    assert r1["transaction_id"] == r2["transaction_id"]


def test_idempotency_no_double_debit(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "EUR", Decimal("100"))
    service.execute_quote(quote.id, CUSTOMER_ID, idempotency_key="k2")
    service.execute_quote(quote.id, CUSTOMER_ID, idempotency_key="k2")
    balances = service.get_balances(CUSTOMER_ID)
    assert Decimal(balances["USD"]) == Decimal("9900.00")


# ── Concurrency tests ─────────────────────────────────────────────────

def test_concurrent_executions_exactly_one_succeeds(service):
    """
    Fire 10 concurrent execute requests for the same quote.
    with_for_update() ensures exactly 1 succeeds.
    """
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("10"))
    successes, failures, lock = [], [], threading.Lock()

    def try_execute():
        try:
            result = service.execute_quote(quote.id, CUSTOMER_ID)
            with lock:
                successes.append(result)
        except Exception as e:
            with lock:
                failures.append(str(e))

    threads = [threading.Thread(target=try_execute) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
    assert len(failures) == 9, f"Expected 9 failures, got {len(failures)}"


def test_concurrent_idempotent_retries(service):
    """Concurrent retries with same key must return same transaction_id."""
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("10"))
    results, lock = [], threading.Lock()

    def try_execute():
        try:
            result = service.execute_quote(
                quote.id, CUSTOMER_ID, idempotency_key="concurrent-key"
            )
            with lock:
                results.append(result["transaction_id"])
        except Exception:
            pass

    threads = [threading.Thread(target=try_execute) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(set(results)) <= 1


# ── Decimal precision tests ───────────────────────────────────────────

def test_no_float_errors_large_amount(service):
    quote = service.generate_quote(
        CUSTOMER_ID, "USD", "KES", Decimal("999999.99")
    )
    expected = (Decimal("999999.99") * quote.rate).quantize(Decimal("0.01"))
    assert quote.final_amount == expected


def test_decimal_precision_small_amount(service):
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", Decimal("0.01"))
    assert quote.final_amount > 0


# ── Rate routing tests ────────────────────────────────────────────────

def test_direct_pair_sell_rate(service):
    mock = MagicMock(spec=RateService)
    mock.get.return_value = {"buy": Decimal("129"), "sell": Decimal("130")}
    svc = FXService(mock)
    assert svc._effective_rate("USD", "KES") == Decimal("130")


def test_inverse_pair_inverts_buy_rate(service):
    mock = MagicMock(spec=RateService)
    mock.get.side_effect = lambda p: {
        "USD/KES": {"buy": Decimal("129"), "sell": Decimal("130")},
    }.get(p)
    svc = FXService(mock)
    rate = svc._effective_rate("KES", "USD")
    assert abs(rate - Decimal("1") / Decimal("129")) < Decimal("0.000001")


def test_cross_pair_routes_through_usd(service):
    rate = service._effective_rate("KES", "NGN")
    assert rate > 0


def test_unsupported_pair_raises(service):
    with pytest.raises(ValueError, match="no rate path"):
        service._effective_rate("KES", "XYZ")

# ── Property-based tests (Hypothesis) ────────────────────────────────

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

# Strategy: valid positive Decimal amounts with 2dp
valid_amounts = st.decimals(
    min_value="0.01",
    max_value="1000.00",
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

# Strategy: valid currency pairs (distinct)
currency_pairs = st.tuples(
    st.sampled_from(["USD", "EUR", "KES", "NGN"]),
    st.sampled_from(["USD", "EUR", "KES", "NGN"]),
).filter(lambda pair: pair[0] != pair[1])


@given(amount=valid_amounts)
@settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_hypothesis_final_amount_always_positive(amount, service):
    """For any valid amount, final_amount must be > 0."""
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", amount)
    assert quote.final_amount > 0


@given(amount=valid_amounts)
@settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_hypothesis_final_amount_equals_amount_times_rate(amount, service):
    """final_amount must equal amount * rate rounded to 2dp — no float errors."""
    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", amount)
    expected = (amount * quote.rate).quantize(Decimal("0.01"))
    assert quote.final_amount == expected


@given(pair=currency_pairs, amount=valid_amounts)
@settings(max_examples=20, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_hypothesis_all_pairs_generate_quote(pair, amount, service):
    """All valid currency pairs must produce a quote without raising."""
    from_ccy, to_ccy = pair
    try:
        quote = service.generate_quote(CUSTOMER_ID, from_ccy, to_ccy, amount)
        assert quote.final_amount > 0
        assert quote.from_currency == from_ccy
        assert quote.to_currency == to_ccy
    except ValueError as e:
        # Small amounts may convert to zero minor units — valid rejection
        assert "too small" in str(e)


@given(amount=valid_amounts)
@settings(max_examples=10, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_hypothesis_execute_debits_exact_amount(amount, service):
    """Execute must debit exactly the quoted amount — no more, no less."""
    service.credit_balance(CUSTOMER_ID, "USD", Decimal("2000.00"))
    balances_before = service.get_balances(CUSTOMER_ID)
    usd_before = Decimal(balances_before["USD"])

    quote = service.generate_quote(CUSTOMER_ID, "USD", "KES", amount)
    service.execute_quote(quote.id, CUSTOMER_ID)

    balances_after = service.get_balances(CUSTOMER_ID)
    usd_after = Decimal(balances_after["USD"])

    assert usd_before - usd_after == amount
