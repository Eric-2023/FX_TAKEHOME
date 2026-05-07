# FX Engine Technical Specification

## Overview

A foreign exchange engine supporting currency conversions between USD,
EUR, KES, and NGN with per-customer balance accounts. Exposes a REST
API for quote generation, quote execution, rate management, and customer
balance operations.

---

## Currency pairs and routing

### Direct pairs (seeded in rate provider)
USD/KES, USD/NGN, USD/EUR, EUR/KES, EUR/NGN, EUR/USD

### Cross pairs (routed via USD)
KES/NGN, NGN/KES, KES/EUR, NGN/EUR — any pair without a direct quote
routes through USD as the intermediate currency.

**Routing rule:** `from_ccy → USD → to_ccy`
- Leg 1: convert `from_ccy` to USD using the `from_ccy/USD` sell rate,
  or the inverse of `USD/from_ccy` buy rate if direct is unavailable.
- Leg 2: convert USD to `to_ccy` using the `USD/to_ccy` sell rate.
- Spreads compound across legs — this is documented and expected.

### Spread model
Each pair has a buy and sell rate derived from a mid-rate with a 50 bps
(0.50%) spread on each side. The bank sells `to_ccy` to the customer at
the sell rate.

---

## Decimal precision and rounding

- All financial arithmetic uses Python `Decimal` throughout — no float
  conversions at any step.
- Rounding mode: `ROUND_HALF_UP` at the final quantize step only.
- Minor units per currency:
  - USD: 2 decimal places (cents)
  - EUR: 2 decimal places (cents)
  - KES: 2 decimal places (cents)
  - NGN: 2 decimal places (kobo)
- Intermediate calculations carry full Decimal precision; quantization
  happens only when producing the final_amount in a quote or transaction.

---

## Core operations

### 1. Generate quote
**Input:** from_currency, to_currency, amount (positive Decimal)
**Output:** quote_id, from_currency, to_currency, amount, rate,
final_amount, expires_at
**Invariants:**
- amount > 0
- from_currency ≠ to_currency
- Quote valid for exactly 60 seconds from created_at
- Rate is locked at quote generation time — execution must honour it
- Quote stored in DB immediately on generation

**Error semantics:**
- 400 if amount ≤ 0
- 400 if currencies are the same
- 400 if no rate path exists for the pair

### 2. Execute quote
**Input:** quote_id, optional idempotency_key
**Output:** transaction_id, quote_id, from_currency, to_currency,
amount, final_amount, rate, executed_at

**Invariants:**
- Quote must exist
- Quote must not be expired (expires_at > now)
- Quote must not already be executed
- Rate used is the rate locked at quote generation — not current rate
- Debit source balance and credit destination balance atomically
- Both legs succeed or neither — if destination credit would fail,
  source debit is rolled back
- Exactly one execution per quote_id regardless of concurrent attempts

**Idempotency:**
- If idempotency_key is provided, a second request with the same key
  returns the original response without re-executing
- Idempotency check is atomic with execution — concurrent retries with
  the same key result in exactly one execution

**Error semantics:**
- 400 if quote not found
- 400 if quote expired
- 400 if quote already executed
- 400 if customer has insufficient balance in source currency

### 3. Update rates
**Input:** none (pulls from upstream)
**Output:** status, updated_at
**Failure policy:**
- If upstream API is unavailable, keep serving the last known rates
- Log the failure with timestamp and last_updated age
- If last_updated is older than 1 hour, include a stale-rates warning
  in the /rates response

### 4. Customer balances
**Operations:** create customer, view balances per currency, credit
balance (test fixture only — not a production endpoint)
**Invariants:**
- Balances are non-negative — execute rejects if source balance
  would go negative
- Balance table is keyed on (customer_id, currency)

---

## Concurrency model

- SQLite with WAL mode enabled for concurrent read/write access
- Quote execution uses DB-level optimistic locking:
  `UPDATE quotes SET executed=1 WHERE id=? AND executed=0`
  rowcount == 0 means another request won already
- This works across multiple processes — no application-level lock needed
- Rate provider uses a threading.RLock for thread-safe reads and atomic
  dict replacement on refresh

---

## Observability

- Correlation/trace ID attached to every request via X-Request-Id header
  or generated UUID
- Structured log lines include: event, quote_id or tx_id, cid, amounts
- `/healthz` returns 200 with DB connectivity status
- `/metrics` endpoint (or structured logs) for quote and execution counts

---

## Out of scope

- Authentication and authorisation
- Production rate source integration (stubbed with seed data)
- Multi-currency balance overdraft protection beyond simple negativity check
- FX margin/profit tracking
- Regulatory reporting