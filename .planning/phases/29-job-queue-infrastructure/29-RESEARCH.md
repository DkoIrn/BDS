# Phase 29: Job Queue Infrastructure - Research

**Researched:** 2026-04-11
**Domain:** PostgreSQL-backed task queue (procrastinate), async worker deployment, real-time progress tracking
**Confidence:** HIGH

## Summary

Phase 29 replaces the current fire-and-forget `BackgroundTasks` pattern in FastAPI with a persistent, retry-capable job queue using **procrastinate** (PostgreSQL-backed). The current `run_validation_background()` function in `backend/app/routers/validation.py` runs validation as an in-process background task that is lost on server restart, has no retry capability, and offers no visibility into job state beyond the dataset status field.

Procrastinate v3.7.x is a mature (5+ years, 1.5k+ GitHub stars) Python 3.10+ library that stores jobs in PostgreSQL tables, uses LISTEN/NOTIFY for instant job pickup, supports async/await natively, and provides built-in retry with exponential backoff. It requires no Redis or additional infrastructure -- it uses the existing Supabase PostgreSQL database. The worker runs as a separate Railway service process for isolation.

**Primary recommendation:** Use procrastinate 3.7.x with PsycopgConnector connecting to Supabase PostgreSQL via direct connection (or session-mode Supavisor on port 5432). Run the worker as a separate Railway service. Track progress via a `job_progress` column on the datasets table, pushed to the frontend via existing Supabase Realtime subscriptions.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use procrastinate (PostgreSQL-backed, no Redis) for the job queue
- Separate Railway worker service (~$5/month) -- isolated from web server
- Worker handles ALL async job types from the start (validation, reports, exports, cross-dataset)
- Auto-retry 3 times silently with exponential backoff; manual retry after exhaustion
- Real-time progress via Supabase Realtime (worker writes progress to a column, frontend subscribes)
- Cancel button for running jobs -- worker checks cancellation flag between validators
- Job history on dashboard (global "Recent Jobs") AND dataset detail (per-dataset)
- Rich error detail: human-friendly summary with expandable technical details (traceback, attempt count, timestamps)
- DB connection: direct connection or Supavisor session-mode pooler (port 5432). Do NOT use transaction pooler (port 6543)

### Claude's Discretion
- Exact progress reporting approach (percentage vs stage-by-stage)
- Backoff delay values for retries
- Procrastinate configuration details (concurrency, queue names)
- Job priority scheme (if any)
- How to make validation idempotent (cleanup before retry)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOBQ-01 | Validation jobs are enqueued persistently so no job is lost on server restart or crash | Procrastinate stores jobs in PostgreSQL `procrastinate_jobs` table; jobs survive restarts by design |
| JOBQ-02 | Failed jobs retry automatically with exponential backoff (up to 3 attempts) | Procrastinate `RetryStrategy(max_attempts=3, exponential_wait=5)` provides built-in exponential backoff |
| JOBQ-03 | User can see job status with progress percentage (not just spinning indicator) | Worker writes progress to datasets table column; Supabase Realtime pushes to frontend |
| JOBQ-04 | After 3 failed retries, user sees clear failure message with "Retry" button | Procrastinate marks job as "failed" after max_attempts; worker writes error details to DB; frontend renders error state with retry action |
| JOBQ-05 | Jobs are idempotent -- retrying a job does not create duplicate validation runs | Worker deletes existing validation_run + issues for the dataset before starting; uses dataset_id as idempotency scope |
| JOBQ-06 | Job status is persisted and queryable via API and UI (history of recent jobs with outcomes) | Custom `job_runs` table links procrastinate job_id to dataset_id with status, timestamps, error details; queryable from both dashboard and dataset detail views |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| procrastinate | ^3.7 | PostgreSQL-backed task queue | Async-native, uses existing Supabase PostgreSQL, no Redis needed, built-in retry/backoff, LISTEN/NOTIFY for instant pickup, job cancellation support |
| psycopg[binary] | ^3.2 | PostgreSQL driver (required by procrastinate) | Procrastinate 3.x requires psycopg v3; the binary variant avoids C compilation on Railway |
| psycopg-pool | ^3.2 | Connection pooling for procrastinate | Required by PsycopgConnector for async connection pool management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (existing) Supabase Realtime | Managed | Push progress/status updates to frontend | Already used for dataset status changes; extend for job progress |
| (existing) httpx | ^0.28 | Supabase REST API calls from worker | Worker reuses existing SupabaseClient pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| procrastinate | ARQ + Redis | Adds Redis infrastructure cost ($5-15/month) and ops burden; procrastinate uses existing PostgreSQL |
| procrastinate | Celery | Overkill for linear pipelines; complex config; requires Redis or RabbitMQ |
| procrastinate | PostgreSQL polling table | Simpler but no LISTEN/NOTIFY, no built-in retry/backoff, no job state machine, must hand-roll everything |

**Installation:**
```bash
pip install "procrastinate[psycopg]>=3.7,<4"
```

This installs procrastinate with psycopg v3 and psycopg-pool as dependencies.

## Architecture Patterns

### Recommended Project Structure
```
backend/
  app/
    queue/
      __init__.py          # Procrastinate app instance
      tasks.py             # Task definitions (validate_dataset, generate_report, etc.)
      worker.py            # Worker entry point for Railway service
    routers/
      validation.py        # Modified: defer_async instead of BackgroundTasks
      jobs.py              # NEW: Job status/history API endpoints
    services/
      validation.py        # Unchanged: run_validation_pipeline()
src/
  components/
    jobs/
      job-progress-bar.tsx     # Progress bar component
      job-history-table.tsx    # Job history list component
      job-error-display.tsx    # Error state with retry button
    realtime-provider.tsx      # Extended: subscribe to job progress updates
  app/
    (dashboard)/
      dashboard/page.tsx       # Extended: Recent Jobs section
    api/
      validate/route.ts        # Modified: enqueue via FastAPI instead of fire-and-forget
      jobs/route.ts            # NEW: Job status/history API
```

### Pattern 1: Procrastinate App Initialization
**What:** Create a shared procrastinate App instance used by both the FastAPI web process (for deferring) and the worker process (for executing).
**When to use:** Always -- this is the entry point for all queue operations.

```python
# backend/app/queue/__init__.py
import procrastinate

app = procrastinate.App(
    connector=procrastinate.PsycopgConnector(
        conninfo="postgresql://postgres:[password]@[host]:5432/postgres",
    ),
    import_paths=["app.queue.tasks"],
)
```

The `conninfo` should use the Supabase direct connection string (or session-mode Supavisor on port 5432). The `import_paths` tells procrastinate where to find task definitions.

### Pattern 2: Task Definition with Retry Strategy
**What:** Define validation as a procrastinate task with exponential backoff retry.
**When to use:** For every async job type.

```python
# backend/app/queue/tasks.py
import procrastinate
from app.queue import app

@app.task(
    name="validate_dataset",
    queue="validation",
    retry=procrastinate.RetryStrategy(
        max_attempts=3,
        exponential_wait=10,  # 10s, 100s, 1000s
        retry_exceptions={Exception},
    ),
)
async def validate_dataset(
    dataset_id: str,
    config_json: dict | None = None,
) -> None:
    """Run validation pipeline as a queued job."""
    # ... implementation wraps existing run_validation_background logic
```

### Pattern 3: Deferring Jobs from FastAPI
**What:** Replace `BackgroundTasks.add_task()` with `task.defer_async()`.
**When to use:** In all FastAPI endpoints that trigger async work.

```python
# In validation router
from app.queue.tasks import validate_dataset

@router.post("/validate", status_code=202)
async def validate_dataset_endpoint(request: ValidateRequest):
    # ... existing checks ...
    
    # Open procrastinate connection for deferring
    async with app.open_async():
        job = await validate_dataset.defer_async(
            dataset_id=request.dataset_id,
            config_json=request.config.model_dump() if request.config else None,
        )
    
    return {"status": "accepted", "dataset_id": request.dataset_id, "job_id": job.id}
```

**Important:** The `app.open_async()` context manager must be active when deferring. For FastAPI, integrate this into the lifespan so the app stays open:

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from app.queue import app as procrastinate_app

@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    async with procrastinate_app.open_async():
        yield

app = FastAPI(lifespan=lifespan)
```

### Pattern 4: Worker Process (Separate Railway Service)
**What:** Run the procrastinate worker as a standalone process.
**When to use:** Always -- this is the job executor.

```python
# backend/app/queue/worker.py
"""Entry point for the Railway worker service."""
from app.queue import app

if __name__ == "__main__":
    app.run_worker(
        queues=["validation", "reports", "exports"],
        concurrency=2,  # 2 sub-workers for I/O-bound validation
        install_signal_handlers=True,
        listen_notify=True,  # Use PostgreSQL LISTEN/NOTIFY for instant pickup
    )
```

Railway service start command: `python -m app.queue.worker`

### Pattern 5: Progress Reporting via Database Column
**What:** Worker writes progress percentage to the datasets table; frontend subscribes via Supabase Realtime.
**When to use:** During long-running validation jobs.

**Recommendation: Stage-by-stage progress (not percentage).** Percentage-based progress is misleading because validators take variable time. Instead, report named stages with counts:

```python
# Stages: "downloading" -> "parsing" -> "validating (3/7 checks)" -> "storing_results" -> "complete"
async def update_progress(supabase, dataset_id: str, stage: str, detail: str = ""):
    supabase.table("datasets").update({
        "validation_progress": {"stage": stage, "detail": detail}
    }).eq("id", dataset_id).execute()
```

The frontend subscribes to the `datasets` table via existing Realtime channel and renders stage names with an animated progress indicator.

### Pattern 6: Job Cancellation
**What:** User clicks Cancel; worker checks flag between validators and aborts.
**When to use:** For running jobs the user wants to stop.

Procrastinate supports cancellation natively:
```python
# Cancel from API:
async with procrastinate_app.open_async():
    await procrastinate_app.job_manager.cancel_job_by_id(job_id, abort=True)

# In the task, check for abort:
@app.task(name="validate_dataset", ...)
async def validate_dataset(dataset_id: str, config_json: dict | None = None, context=None):
    # Between each validator check:
    if context and context.should_abort():
        raise procrastinate.exceptions.JobAborted()
    # For async tasks, CancelledError is raised automatically
```

Note: The `abort_job_polling_interval` controls how quickly the worker detects abort requests. Default polling is reasonable; with `listen_notify=True`, abort notifications arrive near-instantly.

### Pattern 7: Idempotent Validation (Cleanup Before Retry)
**What:** Before running validation, delete any existing results for this dataset from previous attempts.
**When to use:** Every validation job execution (including retries).

```python
async def cleanup_previous_run(supabase, dataset_id: str):
    """Delete existing validation results to ensure idempotency."""
    # Delete issues first (FK constraint)
    supabase.table("validation_issues").delete().eq("dataset_id", dataset_id).execute()
    # Delete the run record
    supabase.table("validation_runs").delete().eq("dataset_id", dataset_id).execute()
```

Call this at the start of every validation job execution, before any new results are written.

### Anti-Patterns to Avoid
- **Running worker in-process with FastAPI:** CPU-intensive pandas validation blocks the event loop, causing health check timeouts. Always use a separate Railway service.
- **Using transaction-mode Supavisor (port 6543):** Procrastinate uses LISTEN/NOTIFY which requires session-level state. Transaction pooler releases connections between queries, breaking LISTEN/NOTIFY.
- **Storing progress in procrastinate_jobs table:** This table is internal to procrastinate. Store progress in the application's own tables (datasets or a dedicated job_runs table).
- **Opening/closing procrastinate app per request:** Use FastAPI lifespan to keep the app open for the duration of the process.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job persistence | Custom PostgreSQL polling table with `FOR UPDATE SKIP LOCKED` | procrastinate | Procrastinate handles the entire job lifecycle (defer, pick up, retry, cancel, abort) with battle-tested SQL and LISTEN/NOTIFY |
| Retry with backoff | Custom retry loop in background task (like current webhooks.py) | procrastinate RetryStrategy | Built-in exponential_wait, max_attempts, retry_exceptions; jobs persist across restarts |
| Job state machine | Custom status enum + transitions | procrastinate job statuses | Procrastinate manages todo/doing/succeeded/failed/cancelled/aborting/aborted transitions with database constraints |
| Worker process management | Custom asyncio task runner | procrastinate worker CLI/API | Handles sub-worker concurrency, signal handling, graceful shutdown |
| LISTEN/NOTIFY integration | Custom PostgreSQL notification listener | procrastinate built-in | One dedicated connection for notifications, automatic fallback to polling |

**Key insight:** Procrastinate handles the hardest parts of job queuing (atomic job pickup with locks, retry state persistence, graceful shutdown, concurrent sub-workers) with PostgreSQL primitives. Building this from scratch would take weeks and miss edge cases.

## Common Pitfalls

### Pitfall 1: Procrastinate Schema Conflicts with Supabase Migrations
**What goes wrong:** Procrastinate creates its own tables (`procrastinate_jobs`, `procrastinate_events`, `procrastinate_workers`, `procrastinate_periodic_defers`) plus enums, functions, triggers, and indexes. Running `procrastinate schema --apply` directly against the Supabase database bypasses the Supabase migration system, making schema state inconsistent.
**Why it happens:** Procrastinate has its own migration system separate from Supabase CLI migrations.
**How to avoid:** Export procrastinate's schema SQL via `procrastinate schema --sql` and wrap it in a Supabase migration file. Run it through `supabase db push` or add it as a numbered migration file. This keeps all schema changes tracked.
**Warning signs:** Tables exist in production but not in migration history; `supabase db diff` shows unexpected objects.

### Pitfall 2: LISTEN/NOTIFY Fails Through Connection Pooler
**What goes wrong:** Procrastinate uses PostgreSQL LISTEN/NOTIFY for instant job pickup. If the worker connects through Supavisor's transaction-mode pooler (port 6543), LISTEN/NOTIFY breaks because the pooler reassigns connections between queries, losing the LISTEN subscription.
**Why it happens:** Developer copies the default Supabase connection string which uses the transaction pooler.
**How to avoid:** Use the direct connection string (bypasses Supavisor entirely) or the session-mode pooler on port 5432. Session mode dedicates a connection per client, preserving LISTEN/NOTIFY state. Set `listen_notify=False` as a fallback if connection issues arise (procrastinate falls back to polling).
**Warning signs:** Worker appears to be running but jobs sit in "todo" status for the full polling interval (default 10s) instead of being picked up instantly.

### Pitfall 3: Fire-and-Forget Migration Leaves Gap in Processing
**What goes wrong:** Switching from BackgroundTasks to procrastinate in a single deploy creates a window where the old code is gone but the new worker is not yet running, causing validation requests to fail.
**Why it happens:** Big-bang migration without a transition period.
**How to avoid:** Deploy in phases: (1) Deploy procrastinate schema + worker service first, (2) Deploy FastAPI code that defers to procrastinate, (3) Keep BackgroundTasks code path behind a feature flag for 1 week as fallback. Use environment variable `USE_JOB_QUEUE=true/false` to toggle.
**Warning signs:** 500 errors on `/api/v1/validate` immediately after deploy.

### Pitfall 4: Validation Job Not Idempotent on Retry
**What goes wrong:** If validation partially completes (writes some issues to DB) then fails, the retry creates duplicate issues because old results are not cleaned up.
**Why it happens:** The current `run_validation_background()` writes results incrementally without cleanup on failure.
**How to avoid:** At the start of every job execution, delete any existing `validation_runs` and `validation_issues` for the dataset. This makes every attempt a clean slate.
**Warning signs:** Duplicate issues appearing after retries; issue counts doubling.

### Pitfall 5: Dataset Status Left in "validating" After Job Failure
**What goes wrong:** The current pattern sets status to "validating" in Next.js before forwarding to FastAPI. If the job queue rejects the job or the worker crashes without updating status, the dataset is stuck in "validating" forever.
**Why it happens:** Status is set optimistically before the job is even enqueued.
**How to avoid:** Only set status to "validating" after confirming the job was successfully enqueued (defer_async returned a job object). Add a sweeper that finds datasets stuck in "validating" for more than 30 minutes and resets them.
**Warning signs:** Datasets permanently showing "validating" with no corresponding job in procrastinate_jobs.

## Code Examples

### Complete Task Definition
```python
# backend/app/queue/tasks.py
import logging
import procrastinate
from app.queue import app
from app.dependencies import get_supabase_client
from app.models.schemas import ProfileConfig

logger = logging.getLogger(__name__)

@app.task(
    name="validate_dataset",
    queue="validation",
    retry=procrastinate.RetryStrategy(
        max_attempts=3,
        exponential_wait=10,  # delays: ~10s, ~100s, ~1000s
    ),
)
async def validate_dataset(dataset_id: str, config_json: dict | None = None) -> None:
    """Persistent, retryable validation job."""
    supabase = get_supabase_client()
    
    try:
        # 1. Update progress
        supabase.table("datasets").update({
            "validation_progress": {"stage": "starting", "detail": "Preparing validation"}
        }).eq("id", dataset_id).execute()
        
        # 2. Cleanup previous results (idempotency)
        supabase.table("validation_issues").delete().eq("dataset_id", dataset_id).execute()
        supabase.table("validation_runs").delete().eq("dataset_id", dataset_id).execute()
        
        # 3. Run validation (reuse existing logic)
        # ... same as current run_validation_background() ...
        
        # 4. Update dataset status
        supabase.table("datasets").update({
            "status": "validated",
            "validation_progress": {"stage": "complete", "detail": "Validation finished"}
        }).eq("id", dataset_id).execute()
        
    except Exception as e:
        # Update progress with error info (procrastinate handles retry decision)
        supabase.table("datasets").update({
            "validation_progress": {
                "stage": "error",
                "detail": str(e)[:500],
            }
        }).eq("id", dataset_id).execute()
        raise  # Re-raise so procrastinate can retry or mark as failed
```

### FastAPI Lifespan Integration
```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.queue import app as procrastinate_app

@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    async with procrastinate_app.open_async():
        yield

app = FastAPI(
    title="TruQC Validation API",
    lifespan=lifespan,
)
```

### Worker Entry Point
```python
# backend/app/queue/worker.py
"""Standalone worker process for Railway service."""
from app.queue import app

def main():
    app.run_worker(
        queues=["validation", "reports", "exports"],
        concurrency=2,
        listen_notify=True,
    )

if __name__ == "__main__":
    main()
```

Railway start command: `python -m app.queue.worker`

### Supabase Migration for Procrastinate Schema
```sql
-- supabase/migrations/20260411_procrastinate_schema.sql
-- Generated via: procrastinate schema --sql
-- Paste the output of that command here.
-- This creates: procrastinate_jobs, procrastinate_events,
-- procrastinate_workers, procrastinate_periodic_defers,
-- plus enums, functions, triggers, and indexes.
```

### Application-Level Job Tracking Table
```sql
-- supabase/migrations/20260411_job_tracking.sql

-- Add progress tracking to datasets
ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS validation_progress JSONB DEFAULT NULL;

-- Job history table for UI display
CREATE TABLE public.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'validation',  -- 'validation', 'report', 'export'
  procrastinate_job_id BIGINT,  -- FK to procrastinate_jobs.id
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  error_summary TEXT,            -- Human-friendly: "File parsing error"
  error_detail TEXT,             -- Technical: full traceback
  config_snapshot JSONB,         -- Validation config used
  result_summary JSONB,          -- {total_issues, critical_count, pass_rate}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_runs_dataset ON job_runs(dataset_id, created_at DESC);
CREATE INDEX idx_job_runs_status ON job_runs(status) WHERE status IN ('queued', 'running');

-- Enable Realtime on job_runs for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_runs;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FastAPI BackgroundTasks | procrastinate PostgreSQL queue | Phase 29 | Jobs survive restarts, retry automatically, visible in UI |
| Fire-and-forget POST | defer_async with job ID return | Phase 29 | Frontend can track individual job lifecycle |
| Binary status (validating/validated/error) | Stage-based progress with detail | Phase 29 | Users see what is happening, not just that something is happening |
| No job history | Queryable job_runs table | Phase 29 | Users and admins can review all past jobs with outcomes |

**Note on STACK.md:** The earlier v1.1 stack research recommended ARQ + Redis. The Phase 29 context discussion overrode this with procrastinate (PostgreSQL-backed) to avoid adding Redis infrastructure. This is the correct decision for a solo developer using Supabase.

## Open Questions

1. **Direct connection vs session-mode Supavisor**
   - What we know: Railway can connect to Supabase via IPv6 direct connection or session-mode Supavisor on port 5432. Both support LISTEN/NOTIFY.
   - What's unclear: Whether Railway's network supports IPv6 to Supabase's direct connection endpoint. Session-mode Supavisor should work but adds a hop.
   - Recommendation: Try direct connection first. Fall back to session-mode Supavisor (port 5432) if direct fails. Add `listen_notify=False` as emergency fallback if both have issues.

2. **Procrastinate schema in Supabase's public schema**
   - What we know: Procrastinate creates ~4 tables, 2 enums, 8 indexes, 7 triggers, and several functions in whatever schema is configured (default: public).
   - What's unclear: Whether Supabase RLS or other policies interfere with procrastinate's internal tables.
   - Recommendation: Use public schema (default). Procrastinate tables are accessed by the service role key (bypasses RLS). Add the schema SQL as a Supabase migration file.

3. **Worker graceful shutdown on Railway deploy**
   - What we know: Railway sends SIGTERM before killing containers. Procrastinate handles SIGTERM gracefully when `install_signal_handlers=True`.
   - What's unclear: The exact Railway shutdown timeout (likely 10-30 seconds).
   - Recommendation: Set `install_signal_handlers=True` on the worker. Long-running validation jobs should checkpoint progress so they can resume cleanly if interrupted (or rely on retry).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x (backend), existing |
| Config file | `backend/pytest.ini` or `pyproject.toml` |
| Quick run command | `cd backend && python -m pytest tests/test_queue.py -x` |
| Full suite command | `cd backend && python -m pytest --cov=app -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOBQ-01 | Job persists to DB on defer | unit | `pytest tests/test_queue.py::test_job_persisted -x` | Wave 0 |
| JOBQ-02 | Failed job retries with backoff | unit | `pytest tests/test_queue.py::test_retry_strategy -x` | Wave 0 |
| JOBQ-03 | Progress updates written to DB | unit | `pytest tests/test_queue.py::test_progress_updates -x` | Wave 0 |
| JOBQ-04 | Max retries exhausted shows error | unit | `pytest tests/test_queue.py::test_max_retries_error -x` | Wave 0 |
| JOBQ-05 | Retry does not create duplicates | unit | `pytest tests/test_queue.py::test_idempotent_cleanup -x` | Wave 0 |
| JOBQ-06 | Job history queryable | integration | `pytest tests/test_queue.py::test_job_history_api -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_queue.py -x`
- **Per wave merge:** `cd backend && python -m pytest --cov=app -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_queue.py` -- covers JOBQ-01 through JOBQ-06
- [ ] `backend/tests/conftest.py` -- may need procrastinate test fixtures (procrastinate provides `InMemoryConnector` for testing)
- [ ] Framework install: `pip install "procrastinate[psycopg]>=3.7,<4"` in requirements.txt

## Sources

### Primary (HIGH confidence)
- [procrastinate GitHub](https://github.com/procrastinate-org/procrastinate) -- repo structure, schema SQL, version 3.7.x
- [procrastinate PyPI](https://pypi.org/project/procrastinate/) -- v3.7.2 (Jan 2026), Python 3.10+ requirement
- [procrastinate quickstart](https://github.com/procrastinate-org/procrastinate/blob/main/docs/quickstart.md) -- App init, task definition, defer, worker launch
- [procrastinate connector docs](https://github.com/procrastinate-org/procrastinate/blob/main/docs/howto/basics/connector.md) -- PsycopgConnector, conninfo, pool_factory
- [procrastinate retry docs](https://github.com/procrastinate-org/procrastinate/blob/main/docs/howto/advanced/retry.md) -- RetryStrategy, max_attempts, exponential_wait
- [procrastinate worker docs](https://github.com/procrastinate-org/procrastinate/blob/main/docs/howto/basics/worker.md) -- CLI, concurrency, install_signal_handlers
- [procrastinate discussions](https://github.com/procrastinate-org/procrastinate/blob/main/docs/discussions.md) -- LISTEN/NOTIFY, job cancellation, abort, connection pooling
- [procrastinate schema.sql](https://github.com/procrastinate-org/procrastinate/blob/main/procrastinate/sql/schema.sql) -- Full DB schema with tables, enums, functions, triggers
- [procrastinate migrations](https://github.com/procrastinate-org/procrastinate/blob/main/docs/howto/production/migrations.md) -- Schema migration approach

### Secondary (MEDIUM confidence)
- [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI) -- Session mode vs transaction mode compatibility
- [Supabase connection docs](https://supabase.com/docs/guides/database/connecting-to-postgres) -- Direct connection, session mode pooler ports
- [LeanIX engineering blog on procrastinate](https://engineering.leanix.net/blog/task-queues-in-python/) -- Production usage patterns

### Tertiary (LOW confidence)
- FastAPI lifespan + asyncio.create_task pattern -- assembled from multiple sources, not procrastinate-specific docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- procrastinate is well-documented, actively maintained (v3.7.2 Jan 2026), and the PostgreSQL-backed approach is validated in the project's context discussion
- Architecture: HIGH -- patterns are directly derived from procrastinate's official docs and match the existing FastAPI/Supabase architecture
- Pitfalls: HIGH -- identified from project-specific context (Supavisor pooling modes, migration system, fire-and-forget transition) and general queue migration experience

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days -- procrastinate is stable, no breaking changes expected)
