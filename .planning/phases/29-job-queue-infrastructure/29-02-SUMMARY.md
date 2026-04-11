---
phase: 29-job-queue-infrastructure
plan: 02
subsystem: ui
tags: [supabase-realtime, job-queue, progress-bar, next-api, tailwind]

# Dependency graph
requires:
  - phase: 29-job-queue-infrastructure (plan 01)
    provides: job_runs table, jobs API endpoints, procrastinate queue backend
provides:
  - Job TypeScript types (JobRun, JobStatus, ValidationProgress)
  - Next.js API proxy routes for job operations (list, detail, retry, cancel)
  - JobProgressBar component with stage-based Realtime progress
  - JobErrorDisplay component with retry button and expandable details
  - JobHistoryTable component with live Realtime updates
  - Dashboard Recent Jobs section
  - Realtime provider extended for job_runs table events
affects: [dataset-versioning, collaboration-core]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-realtime-multi-table, next-api-proxy-to-fastapi, stage-based-progress]

key-files:
  created:
    - src/lib/types/jobs.ts
    - src/app/api/jobs/route.ts
    - src/app/api/jobs/[jobId]/route.ts
    - src/app/api/jobs/[jobId]/retry/route.ts
    - src/app/api/jobs/[jobId]/cancel/route.ts
    - src/components/jobs/job-progress-bar.tsx
    - src/components/jobs/job-error-display.tsx
    - src/components/jobs/job-history-table.tsx
    - src/app/(dashboard)/dashboard/recent-jobs-section.tsx
  modified:
    - src/app/api/validate/route.ts
    - src/app/api/v1/validate/route.ts
    - src/components/realtime-provider.tsx
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "Validate routes now set status to 'queued' instead of 'validating' since the queue task handles status transitions"
  - "Stage-based progress maps stages to approximate percentages (starting=5% through complete=100%)"
  - "Realtime provider subscribes to both datasets and job_runs tables for backward compatibility with USE_JOB_QUEUE=false"

patterns-established:
  - "Next.js API proxy pattern: auth check + org role check + forward to FASTAPI_URL"
  - "Multi-table Realtime subscription: single provider subscribes to multiple Supabase tables"
  - "Stage-based progress: map discrete stages to percentage ranges for smooth progress display"

requirements-completed: [JOBQ-03, JOBQ-06]

# Metrics
duration: 45min
completed: 2026-04-11
---

# Phase 29 Plan 02: Job Queue Frontend UI Summary

**Stage-based progress bar, error/retry display, job history table with Supabase Realtime live updates, and dashboard integration**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-11T21:30:00Z
- **Completed:** 2026-04-11T22:15:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 13

## Accomplishments
- Job TypeScript types and Next.js API proxy routes for all job operations (list, detail, retry, cancel)
- Stage-based progress bar showing real-time validation stages via Supabase Realtime subscription
- Error display with human-friendly messages, expandable technical details, and retry button
- Job history table on dashboard with live updates for recent validation jobs
- Realtime provider extended to subscribe to both datasets and job_runs tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Job types, Next.js API routes, and UI components** - `dfe64e1` (feat)
2. **Task 2: Dashboard integration and Realtime provider extension** - `10df41e` (feat)
3. **Task 3: Human verification checkpoint** - approved by user

## Files Created/Modified
- `src/lib/types/jobs.ts` - JobRun, JobStatus, ValidationProgress type definitions
- `src/app/api/jobs/route.ts` - GET proxy to FastAPI jobs list with query params
- `src/app/api/jobs/[jobId]/route.ts` - GET proxy to FastAPI single job detail
- `src/app/api/jobs/[jobId]/retry/route.ts` - POST proxy to FastAPI retry endpoint
- `src/app/api/jobs/[jobId]/cancel/route.ts` - POST proxy to FastAPI cancel endpoint
- `src/app/api/validate/route.ts` - Updated to extract job_id, set status to "queued"
- `src/app/api/v1/validate/route.ts` - Updated to extract job_id, set status to "queued"
- `src/components/jobs/job-progress-bar.tsx` - Stage-based animated progress with Realtime
- `src/components/jobs/job-error-display.tsx` - Error card with retry and expandable details
- `src/components/jobs/job-history-table.tsx` - Live-updating job history with status colors
- `src/components/realtime-provider.tsx` - Extended for job_runs INSERT/UPDATE events
- `src/app/(dashboard)/dashboard/page.tsx` - Added Recent Jobs section
- `src/app/(dashboard)/dashboard/recent-jobs-section.tsx` - Client wrapper for job history

## Decisions Made
- Validate routes now set dataset status to "queued" instead of "validating" -- queue task handles status transitions
- Stage-based progress maps discrete stages to percentage ranges for smooth UX (starting=5%, downloading=15%, parsing=30%, validating=40-80%, storing_results=90%, complete=100%)
- Realtime provider keeps existing dataset subscription for backward compatibility when USE_JOB_QUEUE=false

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Job queue infrastructure complete (both backend and frontend)
- Phase 30 (Dataset Versioning) can proceed -- job completion events available for triggering snapshot creation
- Realtime subscription patterns established for reuse in collaboration features

## Self-Check: PASSED

All key files verified present. Both task commits (dfe64e1, 10df41e) confirmed in git history.

---
*Phase: 29-job-queue-infrastructure*
*Completed: 2026-04-11*
