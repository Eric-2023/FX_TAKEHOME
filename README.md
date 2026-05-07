# Umba FX Engine

Production-grade foreign exchange engine for USD, EUR, KES, and NGN
with per-customer balance accounts.

**Stack:** FastAPI · PostgreSQL · SQLAlchemy ORM · Alembic · Pydantic v2

---

## Project Structure

```
FX_TAKEHOME/
├── fx_engine/           ← the engine (all source code here)
│   ├── models/          ← SQLAlchemy ORM models
│   │   ├── base.py
│   │   ├── customer.py
│   │   ├── balance.py
│   │   ├── quote.py
│   │   ├── transaction.py
│   │   └── idempotency.py
│   ├── schemas/         ← Pydantic request/response validation
│   │   ├── customer.py
│   │   ├── quote.py
│   │   └── execute.py
│   ├── services/        ← business logic (no HTTP knowledge)
│   │   ├── fx_service.py
│   │   └── rate_service.py
│   ├── routes/          ← HTTP handlers
│   │   ├── health.py
│   │   ├── customers.py
│   │   ├── quotes.py
│   │   └── rates.py
│   ├── utils/
│   │   └── decimal_utils.py
│   ├── tests/
│   │   └── test_fx.py
│   ├── alembic/
│   ├── db.py
│   ├── app.py
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── planted_bugs/        ← Umba's provided code — untouched
├── REVIEW.md            ← code review of planted_bugs
├── SPEC.md              ← technical spec written before coding
├── DECISIONS.md         ← architecture decisions and AI usage
└── CLAUDE.md            ← instructions given to the AI agent
```

---

## Quick Start — One Command

```bash
cp fx_engine/.env.example fx_engine/.env
# Edit .env — add your EXCHANGERATES_API_KEY
docker-compose -f fx_engine/docker-compose.yml up -d
```

API: http://localhost:8000
Interactive docs: http://localhost:8000/docs

---

## Run Locally (without Docker API)

```bash
cd fx_engine
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Start PostgreSQL only
docker-compose up -d db

# Run migrations
alembic upgrade head

# Start API
uvicorn app:app --reload --port 8000
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
POSTGRES_DB=fx_engine
POSTGRES_USER=fx_user
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://fx_user:your_password@localhost:5435/fx_engine
EXCHANGERATES_API_KEY=your_key_from_exchangeratesapi_io
```

Get a free API key at https://exchangeratesapi.io

---

## Run Tests

```bash
cd fx_engine
docker-compose up -d db
alembic upgrade head
pytest tests/ -v
```

Expected output: **26 passed**

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /healthz | DB connectivity + rate staleness |
| POST | /customers | Create customer |
| GET | /customers/{id}/balances | View all currency balances |
| POST | /customers/{id}/credit | Credit balance (test fixture) |
| POST | /quotes | Generate FX quote (60s TTL, locked rate) |
| POST | /quotes/{id}/execute | Execute quote atomically |
| GET | /rates | Current buy/sell rates for all pairs |
| POST | /rates/refresh | Refresh rates from exchangeratesapi.io |
| GET | /docs | Swagger UI — interactive testing |

---

## Full Test Flow

```bash
# 1. Create customer
curl -X POST http://localhost:8000/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Eric Musembi"}'

# 2. Credit USD balance
curl -X POST http://localhost:8000/customers/{customer_id}/credit \
  -H "Content-Type: application/json" \
  -d '{"currency": "USD", "amount": 1000}'

# 3. Check balances
curl http://localhost:8000/customers/{customer_id}/balances

# 4. Generate quote — USD to KES
curl -X POST http://localhost:8000/quotes \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"{id}","from_currency":"USD","to_currency":"KES","amount":100}'

# 5. Execute quote (with idempotency key)
curl -X POST http://localhost:8000/quotes/{quote_id}/execute \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-key-001" \
  -d '{"customer_id": "{id}"}'

# 6. Execute again with same key — returns same transaction_id, no double debit
curl -X POST http://localhost:8000/quotes/{quote_id}/execute \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-key-001" \
  -d '{"customer_id": "{id}"}'

# 7. Verify balances — USD dropped once, KES credited once
curl http://localhost:8000/customers/{customer_id}/balances
```

---

## Example Log Output

```
2026-05-07 10:23:11 INFO fx_service quote_generated quote_id=q-456 customer=abc-123 USD->KES amount=100 rate=129.7957042197 final=12979.57 cid=req-xyz
2026-05-07 10:23:15 INFO fx_service quote_executed tx_id=tx-789 quote_id=q-456 customer=abc-123 USD->KES amount=100 final=12979.57 cid=req-xyz
2026-05-07 10:23:15 INFO fx_service idempotent_hit key=my-key-001 cid=req-abc
```

---

## Key Design Decisions

**PostgreSQL over SQLite** — NUMERIC types for exact decimal storage,
SELECT FOR UPDATE for row-level locking across multiple workers. SQLite
cannot handle concurrent writes in production.

**with_for_update()** — Row-level DB lock on quote and balance rows
during execute. Concurrent requests serialise correctly. Proven by
test_concurrent_executions_exactly_one_succeeds — 10 threads, exactly
1 success, 9 failures.

**Quoted rate honoured** — `quote.rate` stored at generation time,
read at execution. Never re-fetched. Financial contract integrity.

**Atomic two-leg execution** — all steps in one SQLAlchemy session.
Rollback on any failure — nothing is half-done.

**Idempotency via header** — `Idempotency-Key` request header. Checked
and written atomically within the same session as execution.

**Secrets via .env** — No credentials in committed files. All secrets
loaded via python-dotenv. Missing DATABASE_URL raises RuntimeError
immediately.

---

## Known Limitations

- No authentication or authorisation (out of scope per assignment)
- /metrics not implemented — structured logs used for observability
- No rate limiting on execute endpoint
- Quote TTL is 60 seconds — adjust QUOTE_TTL_SECONDS in fx_service.py

---

## What I Would Do With Another Day

- Prometheus /metrics endpoint (quote count, execution latency, rate age)
- Circuit breaker on exchangeratesapi.io with exponential backoff
- APScheduler to auto-refresh rates every 30 minutes
- Async SQLAlchemy (AsyncSession) for higher throughput
- Property-based tests with Hypothesis over random amounts and all pairs
- Rate limiting on execute (token bucket per customer_id)

---

## Estimated Time

- Wall clock: ~14 hours across 2 days
- Active engagement: ~8 hours