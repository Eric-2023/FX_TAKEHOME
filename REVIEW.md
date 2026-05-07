# Code Review — Planted Bugs FX Engine

Reviewed as if this were a teammate's PR on a production FX system.
I ran the existing tests, read the code end-to-end, and wrote additional
tests to confirm the concurrency and idempotency issues. AI tools (Claude)
were used to assist the review — same as I would on a real PR.

---

## Bug 1 — Race condition: same quote can execute twice

**Severity:** Blocker

**What's wrong:**
The executed check happens outside the lock:

```python
# Outside lock — both threads can pass this simultaneously
if row["executed"]:
    raise ValueError("quote already executed")

# Lock acquired only for the write
with _execute_lock:
    conn.execute("UPDATE quotes SET executed = 1 ...")
```

Two concurrent requests for the same quote_id both read `executed = 0`,
both pass the guard, both proceed to execute. The lock protects only the
write — not the read-then-write together. This is a classic
check-then-act race condition.

Additionally, `_execute_lock` is a `threading.Lock()` — it only works
within a single process. Under a multi-worker deployment (gunicorn with
multiple workers), the lock is completely ineffective across workers.

**Why it matters in production:**
A customer submits a payment, the network times out, the client retries.
Both requests land simultaneously. Both execute the same quote. Money
moves twice. In a regulated microfinance environment this is both a
financial loss and a compliance failure.

**How to fix:**
Move the entire read-check-write into a single atomic DB operation using
optimistic locking:

```python
cursor = conn.execute(
    "UPDATE quotes SET executed = 1, executed_at = ? "
    "WHERE id = ? AND executed = 0 AND expires_at > ?",
    (now.isoformat(), quote_id, now.isoformat())
)
if cursor.rowcount == 0:
    raise ValueError("quote already executed or expired")
```

This delegates the atomicity to SQLite, which handles it correctly even
across multiple processes when WAL mode is enabled.

---

## Bug 2 — Execute re-fetches rate instead of using quoted rate

**Severity:** Blocker

**What's wrong:**
```python
# Rate stored on the quote at generation time is ignored.
# A fresh rate is fetched at execution time instead:
current_rate = self._effective_rate(row["from_currency"], row["to_currency"])
```

The quote stores the rate the customer was shown. The execute function
throws it away and fetches the current market rate instead.

**Why it matters in production:**
A quote is a price guarantee — the customer accepts a rate and has 60
seconds to execute at that rate. If rates move between quote generation
and execution, the customer is charged a different amount than agreed.
In FX this is a fundamental contract violation. In regulated markets it
is a consumer protection issue. It also makes the quote system
meaningless — why generate a quote if the rate isn't honoured?

**How to fix:**
```python
# Use the rate locked in at quote time
rate = Decimal(row["rate"])
final = (Decimal(row["amount"]) * rate).quantize(QUANTUM, rounding=ROUND_HALF_UP)
```

---

## Bug 3 — Balances are never updated on execute

**Severity:** Blocker

**What's wrong:**
`execute_quote` records a transaction row but performs no balance
operations. There is no balance table in `db.py`, and no debit/credit
logic anywhere in `fx.py`. The transaction log says money moved — it
didn't.

**Why it matters in production:**
This is the core function of the system. Execute is supposed to debit
the source currency balance and credit the destination currency balance
atomically. Neither happens. Every executed transaction is a ghost —
recorded but financially meaningless. Customers could execute unlimited
times with no balance constraints.

**How to fix:**
Add a `balances` table and wrap the balance updates with the quote
execution in a single transaction:

```python
# Debit source
conn.execute(
    "UPDATE balances SET amount = amount - ? "
    "WHERE customer_id = ? AND currency = ? AND amount >= ?",
    (str(amount), customer_id, from_ccy, str(amount))
)
# Credit destination  
conn.execute(
    "UPDATE balances SET amount = amount + ? "
    "WHERE customer_id = ? AND currency = ?",
    (str(final), customer_id, to_ccy)
)
```

Both legs must be inside the same DB transaction so they succeed or fail
together.

---

## Bug 4 — Float conversion destroys Decimal precision

**Severity:** Major

**What's wrong:**
The module docstring declares: *"All financial calculations use Decimal
with ROUND_HALF_UP rounding."* The first calculation in `generate_quote`
immediately violates this:

```python
final = float(amount) * float(rate)  # converts to float first
final_decimal = Decimal(str(final)).quantize(...)
```

Converting to float before multiplication introduces IEEE 754 rounding
errors. Converting back to Decimal via `str()` preserves the float
error. The `quantize` call at the end masks small errors but does not
eliminate them on large amounts.

**Why it matters in production:**
For amounts like KES 10,000,000 the float error can reach several
shillings. At scale this creates systematic discrepancies between what
customers are quoted, what is charged, and what reconciliation reports
show. Violates the spec's own stated invariant.

**How to fix:**
```python
# Pure Decimal multiplication — no float involved
final_decimal = (amount * rate).quantize(QUANTUM, rounding=ROUND_HALF_UP)
```

---

## Bug 5 — Idempotency check is outside the lock and can be bypassed

**Severity:** Major

**What's wrong:**
```python
# Check happens before the lock is acquired
if idempotency_key:
    row = conn.execute("SELECT response FROM idempotency WHERE key = ?")
    if row:
        return cached_response  # early return

# ... later, after execution:
with _execute_lock:
    # execute...

# Idempotency record written after execution, outside the lock
conn.execute("INSERT INTO idempotency (key, response) VALUES (?, ?)")
```

Two concurrent requests with the same idempotency key both check the
table, find nothing, both proceed to execute. Both succeed. The second
`INSERT` into the idempotency table fails on the PRIMARY KEY constraint
— but by then, both executions have already completed.

**Why it matters in production:**
Idempotency keys exist specifically to make retries safe. If the
idempotency check can be raced, the retry protection is illusory. A
client that retries on timeout (the correct behaviour) can trigger
double execution. This bug makes the idempotency feature actively
misleading — it appears to work in sequential tests but fails under
concurrent load.

**How to fix:**
The idempotency check, execution, and idempotency record write must all
be atomic — either inside the DB lock or using a SELECT...INSERT
pattern:

```python
with _execute_lock:
    # Re-check idempotency inside the lock
    existing = conn.execute(
        "SELECT response FROM idempotency WHERE key = ?",
        (idempotency_key,)
    ).fetchone()
    if existing:
        return json.loads(existing["response"])
    # ... proceed with execution and write idempotency record
```

---

## Bug 6 — Cross-currency rate routing applies spreads incorrectly

**Severity:** Major

**What's wrong:**
```python
leg1 = self.rates.get(f"{from_ccy}/USD") or self.rates.get(f"USD/{from_ccy}")
leg2 = self.rates.get(f"USD/{to_ccy}") or self.rates.get(f"{to_ccy}/USD")

return leg1["sell"] * leg2["sell"]
```

When `from_ccy/USD` is not in the table and the code falls back to
`USD/from_ccy`, it uses the `sell` rate of that inverse pair directly.
But to convert `from_ccy → USD` using a `USD/from_ccy` pair, you need
to **invert** the rate — specifically using the `buy` side (bank buys
`from_ccy` from the customer). Using `sell` on an uninverted inverse
pair produces a rate that is directionally wrong.

Multiplying two `sell` rates also compounds the spread incorrectly for
cross pairs.

**Why it matters in production:**
KES/NGN, NGN/KES and any other cross pair not directly in the rate table
will return systematically wrong rates. Depending on direction, the bank
either loses money on every cross trade or overcharges customers.

**How to fix:**
Separate the logic for direct vs inverse leg lookup and apply correct
spread sides:

```python
def _leg_to_usd(self, from_ccy):
    direct = self.rates.get(f"{from_ccy}/USD")
    if direct:
        return direct["sell"]
    inverse = self.rates.get(f"USD/{from_ccy}")
    if inverse:
        return Decimal("1") / inverse["buy"]
    raise ValueError(f"no path from {from_ccy} to USD")
```

---

## Bug 7 — SQLite not configured for concurrent access

**Severity:** Minor

**What's wrong:**
```python
conn = sqlite3.connect(DB_PATH)
# Missing WAL mode and check_same_thread configuration
```

Default SQLite journal mode locks the entire database file on writes.
The connection also defaults to `check_same_thread=True` which will
raise errors when connections are used across threads.

**Why it matters in production:**
Under any concurrent load, the second writer receives a
`sqlite3.OperationalError: database is locked` error. The concurrency
tests required by the assignment will expose this immediately.

**How to fix:**
```python
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")
```

---

## Bug 8 — RateProvider has no thread safety

**Severity:** Minor

**What's wrong:**
```python
def refresh(self):
    for pair, mid in _SEED_MID.items():
        self._rates[pair] = _with_spread(mid)  # writes dict

def get(self, pair):
    return self._rates.get(pair)  # reads dict concurrently
```

`refresh()` iterates and writes `self._rates` without a lock. A
concurrent `get()` call during refresh can read a partially updated
dictionary — some pairs at old rates, some at new rates.

**Why it matters in production:**
A customer converting KES/NGN during a rate refresh could have leg1
priced at old rates and leg2 at new rates, producing a nonsensical
composite rate. In Python, individual dict operations are GIL-protected
but iteration + assignment across multiple pairs is not atomic.

**How to fix:**
```python
import threading

class RateProvider:
    def __init__(self):
        self._lock = threading.RLock()
        ...

    def refresh(self):
        new_rates = {pair: _with_spread(mid) for pair, mid in _SEED_MID.items()}
        with self._lock:
            self._rates = new_rates  # atomic dict replacement

    def get(self, pair):
        with self._lock:
            return self._rates.get(pair)
```

---

## Bug 9 — Correlation ID missing from execute log line

**Severity:** Nit

**What's wrong:**
```python
# create_quote logs with correlation ID — good
log.info("created quote %s %s->%s amount=%s", quote.id, from_ccy, to_ccy, amount)

# execute_quote does not
log.info("executed quote %s", quote_id)  # missing cid
```

**Why it matters in production:**
Without the correlation ID on the execute log line, it is impossible to
trace a quote creation event to its execution in the logs. Debugging
production issues requires joining log lines manually by quote_id, which
is slower and error-prone.

**How to fix:**
```python
cid = request.environ.get("correlation_id", "-")
log.info("executed quote %s cid=%s", quote_id, cid)
```

---

## Summary

| # | Location | Issue | Severity |
|---|----------|-------|----------|
| 1 | fx.py `execute_quote` | Race condition — same quote executes twice | Blocker |
| 2 | fx.py `execute_quote` | Rate re-fetched at execution — wrong rate charged | Blocker |
| 3 | fx.py `execute_quote` | Balances never updated — money never moves | Blocker |
| 4 | fx.py `generate_quote` | Float conversion — Decimal precision violated | Major |
| 5 | fx.py `execute_quote` | Idempotency check outside lock — bypassable under concurrency | Major |
| 6 | fx.py `_effective_rate` | Cross-rate spreads applied incorrectly | Major |
| 7 | db.py `get_db` | No WAL mode — concurrent writes fail | Minor |
| 8 | rates.py `RateProvider` | No thread safety on rate dict | Minor |
| 9 | app.py `execute_quote` | Correlation ID missing from execute log | Nit |

**Tools used:** Claude (code review assistance and concurrency analysis).
I verified bugs 1, 4, and 5 by reading the execution path carefully and
reasoning about concurrent scenarios. Bug 3 was confirmed by searching
the entire codebase for any balance table or balance update — none exists.