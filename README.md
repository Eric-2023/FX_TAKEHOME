# Umba FX Engine

Production-grade foreign exchange engine for USD, EUR, KES, and NGN
with per-customer balance accounts.

**Stack:** FastAPI · PostgreSQL · SQLAlchemy ORM · Alembic · Pydantic v2 · Prometheus . Docker

---

## Project Structure

```
FX_TAKEHOME/
├── fx_engine/                  ← the engine (all source code here)
│   ├── models/                 ← SQLAlchemy ORM models
│   │   ├── base.py
│   │   ├── customer.py
│   │   ├── balance.py
│   │   ├── quote.py
│   │   ├── transaction.py
│   │   └── idempotency.py
│   ├── schemas/                ← Pydantic request/response validation
│   │   ├── customer.py
│   │   ├── quote.py
│   │   └── execute.py
│   ├── services/               ← business logic (no HTTP knowledge)
│   │   ├── fx_service.py
│   │   └── rate_service.py
│   ├── routes/                 ← HTTP handlers
│   │   ├── health.py           ← GET /healthz
│   │   ├── customers.py        ← GET|POST /customers
│   │   ├── quotes.py           ← GET|POST /quotes
│   │   ├── rates.py            ← GET /rates, POST /rates/refresh
│   │   ├── transactions.py     ← GET /transactions
│   │   └── metrics.py          ← GET /metrics (Prometheus)
│   ├── utils/
│   │   └── decimal_utils.py    ← centralised rounding
│   ├── tests/
│   │   └── test_fx.py          ← 30 tests
│   ├── alembic/                ← database migrations
│   ├── metrics.py              ← Prometheus counters (standalone)
│   ├── db.py                   ← SQLAlchemy engine + session manager
│   ├── app.py                  ← FastAPI app factory
│   ├── alembic.ini
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── postman_collection.json ← ready-to-run Postman collection
├── planted_bugs/               ← Umba's provided code — untouched
├── REVIEW.md                   ← code review of planted_bugs
├── SPEC.md                     ← technical spec written before coding
├── DECISIONS.md                ← architecture decisions and AI usage
└── CLAUDE.md                   ← instructions given to the AI agent
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

Expected output: **30 passed**

Tests cover:
- Customer creation and balance management
- Quote generation and validation
- Quote execution — balance updates, quoted rate honoured
- Concurrency — 10-thread test, exactly 1 execution per quote
- Idempotency — retries with same key never double-debit
- Atomicity — insufficient balance rolls back both legs
- Decimal precision — Hypothesis property-based tests over random amounts
- Rate routing — direct, inverse, and cross pairs

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /healthz | DB connectivity + rate staleness |
| GET | /metrics | Prometheus metrics |
| POST | /customers | Create customer |
| GET | /customers | List all customers |
| GET | /customers/{id} | Get single customer |
| GET | /customers/{id}/balances | View all currency balances |
| POST | /customers/{id}/credit | Credit balance (test fixture) |
| POST | /quotes | Generate FX quote (60s TTL, locked rate) |
| GET | /quotes | List all quotes (filter by ?customer_id=) |
| GET | /quotes/{id} | Get single quote |
| POST | /quotes/{id}/execute | Execute quote atomically |
| GET | /transactions | List all transactions (filter by ?customer_id=) |
| GET | /transactions/{id} | Get single transaction |
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

# 8. List all transactions
curl http://localhost:8000/transactions

# 9. Check Prometheus metrics
curl http://localhost:8000/metrics | grep fx_
```

---

## Example Log Output

```
2026-05-09 03:12:35,087 INFO fx_service customer_created id=a79d0eef cid=req-001
2026-05-09 03:16:08,271 INFO fx_service quote_generated quote_id=a868a91d customer=a79d0eef USD->KES amount=100 rate=130.1475000000 final=13014.75 cid=req-002
2026-05-09 03:16:24,459 INFO fx_service quote_executed tx_id=0c0c71e6 quote_id=a868a91d customer=a79d0eef USD->KES amount=100 final=13014.75 cid=req-003
2026-05-09 03:16:31,112 INFO fx_service idempotent_hit key=my-key-001 cid=req-004
2026-05-09 03:01:13,558 ERROR fx_service rate_refresh_failed age=0s error=HTTP Error 429: Too Many Requests — serving last known rates
```

Logs are written to both terminal and `fx_engine.log` file.

---

## Postman Collection

Import `fx_engine/postman_collection.json` into Postman for ready-to-run
API testing. Import `fx_engine/postman_environment.json` for local
environment variables.

---

## Key Design Decisions

**PostgreSQL over SQLite** — NUMERIC types for exact decimal storage,
SELECT FOR UPDATE for row-level locking across multiple workers.

**with_for_update()** — Row-level DB lock on quote and balance rows
during execute. Proven by test_concurrent_executions_exactly_one_succeeds
— 10 threads, exactly 1 success, 9 failures.

**Quoted rate honoured** — `quote.rate` stored at generation, read at
execution. Never re-fetched. Financial contract integrity.

**Atomic two-leg execution** — all steps in one SQLAlchemy session.
Rollback on any failure — nothing is half-done.

**Idempotency via header** — `Idempotency-Key` request header, industry
standard (Stripe, M-Pesa). Checked and written atomically within the
same session as execution.

**Prometheus /metrics** — standalone metrics.py avoids circular imports.
Counters increment on every quote, execution, idempotency hit, and rate
refresh/failure.

**Secrets via .env** — No credentials in committed files. Missing
DATABASE_URL raises RuntimeError immediately.

**Docker** — same PostgreSQL 16 image locally and in production.
Healthcheck ensures DB is ready before API starts.

---

## Known Limitations

- No authentication or authorisation (out of scope per assignment)
- No rate limiting on execute endpoint
- No background rate refresh — rates refresh on startup and manual POST /rates/refresh
- List endpoints have no pagination

---

## What I Would Do With Another Day

- APScheduler for automatic rate refresh every 30 minutes
- Circuit breaker on exchangeratesapi.io with exponential backoff
- Async SQLAlchemy (AsyncSession) for higher throughput
- Rate limiting on execute (token bucket per customer_id)
- Pagination on list endpoints

---

## Estimated Time

- Wall clock: ~24hrs across 2days
- Active engagement: ~10 hours