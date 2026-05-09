# FX Engine Technical Specification

## Overview

A foreign exchange engine supporting currency conversions between USD,
EUR, KES, and NGN with per-customer balance accounts. Exposes a REST
API for quote generation, quote execution, rate management, and customer
balance operations.

---

## Currency pairs and routing

### Direct pairs (seeded in rate provider)
USD/KES, USD/NGN, USD/EUR, EUR/KES, EUR/NGN, EUR/USD and all inverses.

### Cross pairs (routed via EUR base)
KES/NGN, NGN/KES — any pair without a direct quote routes through EUR
as the intermediate currency (exchangeratesapi.io uses EUR as base).

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
- Rate stored as NUMERIC(20,10) — 10dp to preserve precision on large
  amount multiplications. final_amount stored as NUMERIC(20,2).

---

## Core operations

### 1. Generate quote
**Input:** customer_id, from_currency, to_currency, amount (positive Decimal)
**Output:** quote_id, from_currency, to_currency, amount, rate,
final_amount, expires_at
**Invariants:**
- amount > 0
- from_currency ≠ to_currency
- Both currencies must be in {USD, EUR, KES, NGN}
- Quote valid for exactly 60 seconds from created_at
- Rate is locked at quote generation time — execution must honour it
- Quote stored in DB immediately on generation

**Error semantics:**
- 400 if amount ≤ 0
- 400 if currencies are the same
- 400 if currency not supported
- 400 if no rate path exists for the pair

### 2. Execute quote
**Input:** quote_id, customer_id, optional Idempotency-Key header
**Output:** transaction_id, quote_id, from_currency, to_currency,
amount, final_amount, rate, executed_at

**Invariants:**
- Quote must exist and belong to the requesting customer
- Quote must not be expired (expires_at > now)
- Quote must not already be executed
- Rate used is the rate locked at quote generation — not current rate
- Debit source balance and credit destination balance atomically
- Both legs succeed or neither — single SQLAlchemy session, rollback on any failure
- Exactly one execution per quote_id regardless of concurrent attempts

**Idempotency:**
- If Idempotency-Key header is provided, a second request with the same
  key returns the original response without re-executing
- Idempotency check is atomic with execution — all steps in one session

**Error semantics:**
- 400 if quote not found
- 400 if quote does not belong to customer
- 400 if quote expired
- 400 if quote already executed
- 400 if customer has insufficient balance in source currency

### 3. Update rates
**Source:** exchangeratesapi.io (EUR base, free tier)
**Failure policy:**
- If upstream API is unavailable, keep serving the last known rates
- Seed rates used as fallback on startup if live fetch fails
- Log the failure with timestamp and last_updated age
- If last_updated is older than 1 hour, `stale: true` in /rates response

### 4. Customer balances
**Operations:** create customer, view balances per currency, credit
balance (test fixture only — not a production endpoint)
**Invariants:**
- Balances initialised to zero for all 4 currencies on customer creation
- Balances are non-negative — execute rejects if source balance insufficient
- Balance table is keyed on (customer_id, currency) with unique constraint

---

## Concurrency model

- PostgreSQL with SELECT FOR UPDATE for row-level locking
- Quote execution uses `session.query(Quote).with_for_update()` —
  concurrent requests for the same quote serialise at DB level
- Balance rows also locked with with_for_update() during execute
- Works correctly across multiple workers and processes
- Rate provider uses threading.RLock for thread-safe reads and atomic
  dict replacement on refresh

---

## Observability

- Correlation/trace ID attached to every request via X-Request-Id header
  or auto-generated UUID
- Structured log lines include: event, quote_id or tx_id, cid, amounts
- `/healthz` returns DB connectivity status and rate staleness
- Structured logs serve as observability — all key events logged with cid

---

## Out of scope

- Authentication and authorisation
- /metrics endpoint (Prometheus)
- Multi-tenancy
- Rate limiting on execute endpoint
- FX margin/profit tracking
- Regulatory reporting

---

## Assumptions and ambiguity decisions

The brief left several areas open. Rather than asking, I made explicit
decisions and documented them here — as the brief requested.

### Rate source
The brief says "e.g. exchangeratesapi.io" — I treated this as a
suggestion not a requirement. The free tier of exchangeratesapi.io uses
EUR as the base currency, not USD. I derived all pairs from EUR base
rates and documented the routing rule. I also used open.er-api.com as a
fallback reference during development since it requires no API key.

### Cross-pair routing
The brief says "route through USD or EUR" but doesn't specify which.
I chose EUR as the primary intermediate since exchangeratesapi.io uses
EUR as base — this avoids an extra division step and reduces rounding
error. All cross pairs (KES/NGN, NGN/KES) route via EUR. Documented
in the routing section above.

### Spread model
The brief says "rates include buy/sell spreads" but doesn't specify
the spread size. I chose 50 basis points (0.5%) each side — a
realistic retail FX spread for African markets. Documented in
SPEC.md and applied consistently across all pairs.

### Idempotency mechanism
The brief says "client retries with the same idempotency key" but
doesn't specify how the key is passed. I used the `Idempotency-Key`
request header — the industry standard (used by Stripe, M-Pesa, etc.).
This is more RESTful than a body field since idempotency is a
request property not a business entity.

### Minimum amount validation
During property-based testing (Hypothesis), I discovered that very
small amounts (e.g. 0.01 KES → USD) produce a final_amount of 0.00
after rounding. Rather than silently accepting this, I added a
validation that rejects amounts too small to produce at least one
minor unit in the destination currency. This is the correct
production behaviour — a bank would reject such a transaction.

### Customer ID format
The brief doesn't specify customer ID format. I used UUID v4 —
globally unique, no sequential enumeration risk, standard for
financial APIs.

### Balance initialisation
The brief says "create a customer" but doesn't specify whether
balances should be pre-created. I initialise zero balances for all
4 currencies on customer creation — this simplifies execute (no
need to create balance rows on first trade) and makes balance
queries consistent from day one.