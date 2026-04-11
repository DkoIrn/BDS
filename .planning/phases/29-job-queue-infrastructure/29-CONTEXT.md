# Phase 29: Job Queue Infrastructure - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace fire-and-forget validation processing (FastAPI BackgroundTasks) with a persistent, retry-capable job queue using procrastinate (PostgreSQL-backed). Jobs survive restarts, retry on failure, report progress in real-time, and are queryable via UI and API. This phase also sets up the worker infrastructure for all future async jobs (reports, cross-dataset, exports).

</domain>

<decisions>
## Implementation Decisions

### Progress Reporting
- Claude's discretion on exact approach (percentage bar vs stage-by-stage) — pick what integrates best
- Progress updates push via Supabase Realtime (worker writes progress to a column, frontend subscribes) — same pattern as existing status changes
- User can cancel a running job via Cancel button — worker checks cancellation flag between validators

### Failure UX
- Auto-retry 3 times silently in background with exponential backoff — user doesn't see transient failures
- Only if all 3 retries fail: show toast notification AND dedicated inline error state on dataset/pipeline page
- Error detail: human-friendly summary ("Validation failed: file parsing error") with expandable section for technical details (traceback, attempt count, timestamps)
- Prominent Retry button on the error state

### Job History UI
- Two locations: dashboard "Recent Jobs" section (global) AND dataset detail tab (per-dataset)
- Rich detail per entry: status icon, dataset name, timestamp, duration, issue count, validation profile used, retry count, expandable error log
- Dashboard section auto-refreshes via Supabase Realtime (live updates as jobs complete/fail)

### Worker Deployment
- Separate Railway service (~$5/month) — isolated from web server, heavy validation won't slow API responses
- Worker handles ALL async job types from the start (validation, reports, exports, cross-dataset) — not just validation
- DB connection: direct connection if Railway→Supabase IPv6 works; otherwise Supavisor session-mode pooler on port 5432. Do NOT use transaction pooler on port 6543 for the worker.

### Claude's Discretion
- Exact progress reporting approach (percentage vs stage-by-stage)
- Backoff delay values for retries
- Procrastinate configuration details (concurrency, queue names)
- Job priority scheme (if any)
- How to make validation idempotent (cleanup before retry)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/webhooks.py`: Existing retry pattern with MAX_ATTEMPTS=3, BACKOFF_DELAYS=[5,30] — reference for retry logic
- `src/components/realtime-provider.tsx`: Global Supabase Realtime subscription — extend for job progress updates
- `src/components/files/file-detail-view.tsx`: Per-dataset Realtime subscription — extend for job status
- `backend/app/routers/validation.py:run_validation_background()`: Current validation task — refactor into procrastinate job

### Established Patterns
- Status set in Next.js before FastAPI call (race condition prevention) — may need adjustment for queue-based flow
- Fire-and-forget POST to FastAPI with 202 Accepted — replace with job enqueue
- Supabase Realtime for push notifications — keep and extend for progress
- Dataset status field (`validating` → `validated` | `validation_error`) — extend with job-aware states

### Integration Points
- `src/app/api/validate/route.ts` (lines 100-104): Replace fire-and-forget fetch with job enqueue
- `src/app/api/v1/validate/route.ts` (lines 128-131): Enterprise API trigger — also needs queue integration
- `backend/app/routers/validation.py` (lines 173-192): Replace BackgroundTasks with procrastinate job registration
- `supabase/migrations/`: New tables for job queue metadata (procrastinate handles its own tables, but need jobs UI table)
- Dashboard page: Add "Recent Jobs" section
- Dataset detail page: Add "Job History" tab

</code_context>

<specifics>
## Specific Ideas

- The advisor emphasized: "No QC job can silently fail" — this is the #1 success criteria
- Worker should be designed as a generic job runner from day one, even though only validation jobs exist now
- Procrastinate uses PostgreSQL LISTEN/NOTIFY — needs session-mode connection, not transaction pooler

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-job-queue-infrastructure*
*Context gathered: 2026-04-11*
