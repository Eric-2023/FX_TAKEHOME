# Agent Instructions — FX Engine Build

## Stack
FastAPI + PostgreSQL + SQLAlchemy ORM + Alembic + Pydantic v2

## Hard constraints — never violate these

1. **No float arithmetic.** Python Decimal throughout. quantize() only
   at final output step. utils/decimal_utils.py centralises this.

2. **with_for_update() for execute concurrency.** Never threading.Lock.
   Lock both the quote row and balance rows before any modification.

3. **Execute uses quote.rate — never re-fetches.** The quoted rate is
   the financial contract. Do not call _effective_rate() at execute time.

4. **All execute steps in one session.** Idempotency check, lock,
   validate, mark executed, debit, credit, transaction, idempotency
   write — all in a single get_db() session context.

5. **Models own their column definitions.** No schema strings in db.py.
   SQLAlchemy mapped_column() in each model class.

6. **No circular imports.** Routes receive services via factory injection.

7. **All log lines include cid.** Pass cid through every log call.

8. **No hardcoded credentials.** All secrets via .env and python-dotenv.
   Missing DATABASE_URL raises RuntimeError — never falls back silently.

9. **Health check uses session.execute(text()).** Never session.cursor() —
   that is psycopg2, not SQLAlchemy ORM.

10. **Access ORM attributes inside session.** Call session.refresh() and
    session.expunge() before closing session if object needed after close.

## What NOT to generate
- Auth/JWT — out of scope
- Raw SQL strings — use ORM query API
- threading.Lock for concurrency
- Float arithmetic for money
- Hardcoded DB credentials or API keys

## When uncertain
Refer to SPEC.md. Ask before generating financial logic.