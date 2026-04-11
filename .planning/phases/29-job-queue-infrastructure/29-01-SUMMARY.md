---
phase: 29-job-queue-infrastructure
plan: 01
subsystem: infra
tags: [procrastinate, job-queue, postgresql, async, retry, background-tasks]

requires:
  - phase: 06-validation-tables
    provides: validation_runs and validation_issues tables
provides:
  - Procrastinate job queue app instance with PsycopgConnector
  - validate_dataset task with 3-attempt retry and exponential backoff
  - Standalone worker entry point for Railway service
  - Job status API (list, detail, retry, cancel)
  - Feature-flagged validation router (queue vs legacy BackgroundTasks)
  - Procrastinate schema migration and job_runs tracking table
  - Idempotent cleanup before every validation attempt
affects: [29-02-frontend-job-tracking, 30-custom-rule-builder, 31-certificate-generation]

tech-stack:
  added: [procrastinate 3.8.x, psycopg 3.3.x, psycopg-binary, psycopg-pool]
  patterns: [procrastinate task queue, feature-flag transition, lazy imports for heavy deps]

key-files:
  created:
    - backend/app/queue/__init__.py
    - backend/app/queue/tasks.py
    - backend/app/queue/worker.py
    - backend/app/routers/jobs.py
    - backend/tests/test_job_queue.py
    - supabase/migrations/20260411_procrastinate_schema.sql
    - supabase/migrations/20260411_job_tracking.sql
  modified:
    - backend/requirements.txt
    - backend/app/main.py
    - backend/app/config.py
    - backend/app/dependencies.py
    - backend/app/routers/validation.py

key-decisions:
  - "Use InMemoryConnector fallback when DATABASE_URL not set (dev/test safety)"
  - "Lazy imports for pandas/validators in task body to keep module import fast"
  - "USE_JOB_QUEUE feature flag defaults to false for safe transition"
  - "Added DeleteQuery to SupabaseClient for idempotent cleanup support"

patterns-established:
  - "Procrastinate task pattern: @app.task decorator with RetryStrategy, lazy heavy imports in body"
  - "Feature-flag transition: settings.use_job_queue gates queue vs legacy path"
  - "Job tracking: record_job_run helper inserts to job_runs table for UI visibility"
  - "Progress reporting: update_progress writes {stage, detail} JSONB to datasets.validation_progress"

requirements-completed: [JOBQ-01, JOBQ-02, JOBQ-04, JOBQ-05]

duration: 67min
completed: 2026-04-11
---

# Phase 29 Plan 01: Job Queue Infrastructure Summary

**Procrastinate PostgreSQL-backed job queue with retry strategy, idempotent cleanup, feature-flagged validation router, and job status API**

## Performance

- **Duration:** 67 min
- **Started:** 2026-04-11T20:21:32Z
- **Completed:** 2026-04-11T21:28:47Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Procrastinate job queue fully configured with PsycopgConnector, InMemoryConnector fallback, and 3-attempt exponential backoff retry
- Validation router refactored with USE_JOB_QUEUE feature flag preserving legacy BackgroundTasks path
- Jobs API with list/detail/retry/cancel endpoints for full job lifecycle management
- Two SQL migrations: procrastinate internal schema and application-level job_runs tracking table with RLS
- 28 unit tests passing covering app config, task registration, retry strategy, cleanup, progress, job persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Procrastinate queue infrastructure and migrations** - `c3abe5c` (feat)
2. **Task 2: Refactor validation router and add jobs API** - `44ece79` (feat)

## Files Created/Modified
- `backend/app/queue/__init__.py` - Procrastinate App instance with PsycopgConnector, InMemoryConnector fallback, USE_JOB_QUEUE flag
- `backend/app/queue/tasks.py` - validate_dataset task with retry, cleanup_previous_run, update_progress, record_job_run helpers
- `backend/app/queue/worker.py` - Standalone worker entry point for Railway (queues: validation, reports, exports)
- `backend/app/routers/jobs.py` - Job status API: GET list, GET detail, POST retry, POST cancel
- `backend/app/routers/validation.py` - Refactored with feature flag: queue path (defer_async) vs legacy path (BackgroundTasks)
- `backend/app/main.py` - Added lifespan for procrastinate, registered jobs router
- `backend/app/config.py` - Added database_url and use_job_queue settings
- `backend/app/dependencies.py` - Added DeleteQuery class for idempotent cleanup
- `backend/requirements.txt` - Added procrastinate[psycopg]>=3.7,<4
- `backend/tests/test_job_queue.py` - 28 unit tests for queue infrastructure
- `supabase/migrations/20260411_procrastinate_schema.sql` - Procrastinate internal tables, enums, functions, triggers
- `supabase/migrations/20260411_job_tracking.sql` - job_runs table, datasets.validation_progress column, RLS policies

## Decisions Made
- Used InMemoryConnector as fallback when DATABASE_URL not set, allowing local development without PostgreSQL
- Moved heavy imports (pandas, validators, services) to lazy loading inside task body to keep module import fast and testable
- Feature flag defaults to false (USE_JOB_QUEUE=false) for safe production transition per Pitfall 3 in research
- Added DeleteQuery to the lightweight SupabaseClient (Rule 3 -- blocking issue: needed for idempotent cleanup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DeleteQuery to SupabaseClient**
- **Found during:** Task 1 (cleanup_previous_run implementation)
- **Issue:** SupabaseClient had no delete() method, required for idempotent cleanup of validation_issues and validation_runs
- **Fix:** Added DeleteQuery class with eq() chaining and execute() method to dependencies.py
- **Files modified:** backend/app/dependencies.py
- **Verification:** cleanup_previous_run tests pass with mock supabase client
- **Committed in:** c3abe5c (Task 1 commit)

**2. [Rule 3 - Blocking] Lazy imports for pandas/validators in task body**
- **Found during:** Task 1 (test execution)
- **Issue:** pandas import hangs on Python 3.14 in test environment, blocking all tests that import the tasks module
- **Fix:** Moved pandas, validators, and service imports from module-level to inside the async task body
- **Files modified:** backend/app/queue/tasks.py
- **Verification:** Module imports in <1 second, all 28 tests pass
- **Committed in:** c3abe5c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correctness and testability. No scope creep.

## Issues Encountered
- psycopg-binary initially appeared unavailable for Python 3.14 (pip commands were running in background). Eventually confirmed that psycopg-binary 3.3.3 does have cp314 wheels for win_amd64
- pandas import hangs on Python 3.14 in the test environment, preventing pytest from running any test files that import pandas via conftest.py. Tests were run via direct Python execution instead of pytest to bypass conftest

## User Setup Required
None - no external service configuration required. DATABASE_URL and USE_JOB_QUEUE environment variables should be set on Railway when deploying the worker service.

## Next Phase Readiness
- Queue infrastructure ready for Plan 02 (frontend job tracking)
- Procrastinate schema migration needs to be applied to production database
- Worker service needs to be deployed as separate Railway service
- USE_JOB_QUEUE=true should be enabled after worker is confirmed running

---
*Phase: 29-job-queue-infrastructure*
*Completed: 2026-04-11*
