---
phase: 05-validation-engine
plan: 02
subsystem: database, api
tags: [supabase, rls, validation, fastapi, proxy, server-actions]

requires:
  - phase: 04-ingestion-pipeline
    provides: datasets table with status field and column mappings
provides:
  - validation_runs and validation_issues database tables with RLS
  - TypeScript types for validation results (ValidationRun, ValidationIssue, ValidationSeverity)
  - POST /api/validate proxy endpoint to FastAPI
  - Server actions for fetching validation runs and issues
  - Extended DatasetStatus with validating/validated/validation_error states
affects: [05-validation-engine, 06-results-dashboard]

tech-stack:
  added: []
  patterns: [fastapi-proxy-pattern, server-action-ownership-check]

key-files:
  created:
    - supabase/migrations/00006_validation_tables.sql
    - src/lib/types/validation.ts
    - src/app/api/validate/route.ts
    - src/lib/actions/validation.ts
  modified:
    - src/lib/types/files.ts
    - src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx

key-decisions:
  - "FastAPI proxy pattern: API route handles auth/ownership then delegates to FastAPI, does not update status to validated (FastAPI does that)"
  - "Severity sorting: client-side sort for issues since Supabase order() does not support custom ordinals"

patterns-established:
  - "FastAPI proxy: auth check -> ownership verify -> status transition -> fetch to FASTAPI_URL -> error rollback"
  - "Validation server actions: ownership verified via dataset join before returning data"

requirements-completed: [VALE-07]

duration: 2min
completed: 2026-03-11
---

# Phase 5 Plan 2: Validation Schema & API Route Summary

**Validation database schema with RLS, TypeScript types, and FastAPI proxy endpoint with auth/ownership checks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T17:05:06Z
- **Completed:** 2026-03-11T17:07:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created validation_runs and validation_issues tables with proper constraints, indexes, and RLS policies
- Extended DatasetStatus type with validating, validated, and validation_error states
- Built /api/validate POST route that proxies to FastAPI with full auth, ownership, and status management
- Added server actions for fetching validation runs and issues with ownership verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and TypeScript types** - `eb70de4` (feat)
2. **Task 2: Next.js validation API route and server actions** - `84b5f06` (feat)

## Files Created/Modified
- `supabase/migrations/00006_validation_tables.sql` - validation_runs and validation_issues tables with RLS
- `src/lib/types/validation.ts` - ValidationRun, ValidationIssue, ValidationSeverity types
- `src/lib/types/files.ts` - Extended DatasetStatus with validation states
- `src/app/api/validate/route.ts` - POST endpoint proxying validation to FastAPI
- `src/lib/actions/validation.ts` - getValidationRuns and getValidationIssues server actions
- `src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx` - Updated statusVariantMap for new statuses

## Decisions Made
- FastAPI proxy pattern: the API route does NOT update status to "validated" -- that responsibility belongs to FastAPI after it writes results to the database
- Severity sorting done client-side in the server action since Supabase order() doesn't support custom ordinal values
- FASTAPI_URL uses no NEXT_PUBLIC_ prefix to keep it server-side only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed statusVariantMap type error in file detail page**
- **Found during:** Task 1 (DatasetStatus extension)
- **Issue:** Existing Record<DatasetStatus, ...> map was missing new validation status keys, causing TypeScript error
- **Fix:** Added validating, validated, and validation_error entries to the map
- **Files modified:** src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** eb70de4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for type safety after extending DatasetStatus. No scope creep.

## Issues Encountered
None

## User Setup Required
None - FASTAPI_URL added to .env.local with localhost placeholder. FastAPI backend will be configured in a later phase.

## Next Phase Readiness
- Database schema ready for FastAPI to write validation results
- API route ready to proxy requests once FastAPI backend is running
- Server actions ready for results dashboard to consume validation data

---
*Phase: 05-validation-engine*
*Completed: 2026-03-11*
