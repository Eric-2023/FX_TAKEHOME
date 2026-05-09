# Decisions and Trade-offs

## Architecture decisions

### FastAPI + SQLAlchemy ORM + PostgreSQL + Alembic
The assignment calls for production-ready design. This stack is what
senior Python engineers at fintech companies actually use:

- **FastAPI** — Pydantic schemas make the API contract executable.
  Auto-generated /docs lets reviewers test without Postman. Type-safe
  request validation replaces manual try/except chains.

- **SQLAlchemy ORM** — Models are Python classes, not CREATE TABLE strings.
  Relationships are declared and traversable. Type-safe column access
  replaces string-based raw SQL. Connection pooling is handled by the
  engine. Sessions replace manual psycopg2 connection management.
  Modern SQLAlchemy 2.0 Mapped[] style used throughout for type safety.

- **PostgreSQL** — NUMERIC(20,10) for rate storage, NUMERIC(20,2) for
  final amounts, NUMERIC(20,6) for balances. SELECT FOR UPDATE for
  row-level locking. ACID transactions across concurrent connections.
  The right database for financial data.

- **Alembic** — Schema migrations tracked in version control. Adding a
  column in production means `alembic revision --autogenerate` then
  `alembic upgrade head` — not recreating tables and losing data.

### Docker for local development and production parity
PostgreSQL runs in Docker — same image, same version (16), same config
locally and in production. docker-compose.yml includes a healthcheck so
the API never starts before the DB is ready. Port mapped to 5435 to avoid
conflicts with any local PostgreSQL instance. Credentials loaded from .env
via ${VAR} substitution — no hardcoded secrets in docker-compose.yml.

### Layered architecture
```
app.py → routes/ → services/ → models/ + utils/ + db.py
         schemas/
```
Each layer has one responsibility. Models own data shapes and
relationships. Schemas own request/response validation. Services own
business logic. Routes own HTTP handling. Nothing imports backwards.

Services injected into route factories — no circular imports.

### with_for_update() for concurrency
`session.query(Quote).with_for_update().first()` acquires a
PostgreSQL row-level lock. Concurrent execute requests for the same
quote_id serialise at the DB level — the second request blocks until
the first commits, then sees executed=True and raises.
Works correctly across multiple workers and processes.
Proven by test_concurrent_executions_exactly_one_succeeds — 10 threads,
exactly 1 success.

### Decimal throughout
NUMERIC columns in PostgreSQL + Python Decimal in application code.
SQLAlchemy maps NUMERIC columns to Python Decimal automatically.
quantize() called only at final output step (utils/decimal_utils.py).
Rate stored as NUMERIC(20,10) — discovered during testing that NUMERIC(20,6)
caused precision loss on large amount multiplications.

### exchangeratesapi.io with seed fallback
The assignment suggests exchangeratesapi.io. Free tier uses EUR as base
currency — all pairs derived from EUR base rates. Seed rates loaded on
startup as fallback if live fetch fails. Last-updated timestamp tracked
with 1-hour staleness threshold.

### Secrets via .env
All credentials (DATABASE_URL, EXCHANGERATES_API_KEY, POSTGRES_PASSWORD)
loaded from .env via python-dotenv. docker-compose.yml uses ${VAR}
substitution. Missing DATABASE_URL raises RuntimeError immediately rather
than falling back to a hardcoded default — fail fast, never silently.

---

## What I owned vs delegated to AI

### Owned
- SPEC.md — written before any prompting
- All architecture decisions (ORM, PostgreSQL, Alembic, layered structure)
- REVIEW.md — read planted_bugs myself first, then used AI for cross-check
- with_for_update() vs threading.Lock decision
- Catching the rate re-fetch bug (same as planted_bugs Bug 2)
- Catching the float arithmetic bug (same as planted_bugs Bug 4)
- Security review — identified hardcoded credentials in docker-compose,
  alembic.ini, and db.py and moved all secrets to .env

### Delegated
- Boilerplate ORM column definitions (reviewed before use)
- Initial test scaffolding (extended with edge cases)
- Route handler boilerplate

### What I rejected or overrode
- AI used threading.Lock — replaced with with_for_update()
- AI re-fetched rate at execution — fixed to use quote.rate
- AI used float arithmetic in early draft — caught and fixed
- AI put schema definitions in db.py — moved to each model class
- AI used Session.cursor() for health check — not valid in ORM sessions,
  fixed to session.execute(text("SELECT 1"))
- AI caused DetachedInstanceError by accessing ORM attributes after
  session closed — fixed with session.refresh() + session.expunge()
- AI hardcoded credentials in docker-compose.yml and alembic.ini —
  moved all secrets to .env with python-dotenv

### What I did not trust without verifying
- All financial calculations — tested with large and small amounts,
  discovered NUMERIC(20,6) rate precision was insufficient at scale
- Concurrency — ran 10-thread test, verified exactly one success
- Idempotency — verified balance debited exactly once under concurrent retry
- Secret exposure — ran grep across all committed files for credentials

### One thing the AI got wrong
The AI generated `session.cursor()` for the health check DB ping — a
psycopg2 pattern that does not exist on SQLAlchemy Session objects. The
error only appeared at runtime (`'Session' object has no attribute 'cursor'`).
Fixed to `session.execute(text("SELECT 1"))` which is the correct ORM
approach. This reinforced the rule: never trust AI-generated DB
interaction code without running it.

---

## Known limitations and what I'd do with another day

### Current limitations
- No authentication or authorisation (out of scope per assignment)
- /metrics endpoint not implemented — structured logs used instead
- No rate limiting on execute endpoint
- Tests use TRUNCATE to clear data between runs — production uses
  `alembic upgrade head`

### With another day
- Add Prometheus /metrics endpoint (quote count, execution count, rate age)
- Add circuit breaker on exchangeratesapi.io with exponential backoff
- Async SQLAlchemy (AsyncSession) for better throughput under load
- Property-based tests with Hypothesis over random amounts and all pairs
- Rate limiting on execute (token bucket per customer_id)
- APScheduler to auto-refresh rates every 30 minutes