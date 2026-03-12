---
phase: 07-async-processing
plan: 01
subsystem: api
tags: [fastapi, backgroundtasks, async, realtime, supabase, fire-and-forget]

requires:
  - phase: 05-validation-engine
    provides: validation pipeline and FastAPI validate endpoint
  - phase: 06-validation-profiles
    provides: profile config and template resolution
provides:
  - async fire-and-forget validation via BackgroundTasks
  - 202 Accepted response pattern for validation requests
  - Supabase Realtime publication on datasets table
affects: [07-async-processing, frontend-realtime-subscriptions]

tech-stack:
  added: []
  patterns: [fire-and-forget-proxy, background-tasks, realtime-publication]

key-files:
  created:
    - supabase/migrations/20260312_enable_realtime_datasets.sql
  modified:
    - backend/app/routers/validation.py
    - src/app/api/validate/route.ts

key-decisions:
  - "Next.js sets 'validating' status, not FastAPI -- avoids race condition"
  - "FastAPI background function catches all exceptions to prevent stuck 'validating' state"
  - "502 for FastAPI errors, 503 for connection failures -- distinct error codes for debugging"

patterns-established:
  - "Fire-and-forget proxy: Next.js confirms reachability then returns 202, backend processes async"
  - "Background error safety: broad try/except with status update guarantees no stuck states"

requirements-completed: [PROC-01]

duration: 2min
completed: 2026-03-12
---

# Phase 7 Plan 1: Async Fire-and-Forget Validation Summary

**Converted sync validation pipeline to async BackgroundTasks with 202 Accepted responses and Supabase Realtime publication**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T20:40:30Z
- **Completed:** 2026-03-12T20:42:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- FastAPI validate endpoint now returns 202 immediately and processes validation in BackgroundTasks
- Next.js API route returns 202 Accepted after confirming FastAPI is reachable (no blocking)
- Supabase Realtime enabled on datasets table for downstream status subscriptions
- Error handling ensures datasets never get stuck in 'validating' state

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor FastAPI validate endpoint to use BackgroundTasks** - `72a5bf4` (feat)
2. **Task 2: Refactor Next.js validate route to fire-and-forget + enable Realtime** - `47f86f0` (feat)

## Files Created/Modified
- `backend/app/routers/validation.py` - BackgroundTasks-based async validation with error safety
- `src/app/api/validate/route.ts` - Fire-and-forget proxy returning 202 Accepted
- `supabase/migrations/20260312_enable_realtime_datasets.sql` - Realtime publication for datasets table

## Decisions Made
- Next.js sets 'validating' status before calling FastAPI (avoids race condition where background task could complete before status is set)
- FastAPI background function has double try/except -- outer catches validation errors, inner catches status-update errors
- Removed maxDuration from API route since it no longer blocks on validation
- Used 502 for FastAPI rejection errors vs 503 for connection failures for clear debugging

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Async validation pipeline ready for frontend integration
- Supabase Realtime publication enabled -- frontend can subscribe to dataset status changes
- Next plans can add Realtime subscription hooks and polling UI

---
*Phase: 07-async-processing*
*Completed: 2026-03-12*
