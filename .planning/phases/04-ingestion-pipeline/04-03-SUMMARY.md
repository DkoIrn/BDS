---
phase: 04-ingestion-pipeline
plan: 03
subsystem: ui
tags: [column-mapping, data-preview, file-detail, status-badges, shadcn]

requires:
  - phase: 04-ingestion-pipeline/02
    provides: Parse API route, auto-parse trigger, extended Dataset types with column_mappings/parse_warnings, saveColumnMappings server action
  - phase: 04-ingestion-pipeline/01
    provides: CSV/Excel parsers, header detector, column type detector, DetectedColumn/ColumnMapping/ParseWarning types
provides:
  - File detail page at /projects/[projectId]/jobs/[jobId]/files/[fileId]
  - Interactive column mapping table with confidence badges and dropdown selectors
  - Data preview table with column reordering (mapped first, unmapped, ignored)
  - Parsing warning banner with expandable details
  - File list status badges (uploaded/parsing/parsed/mapped/error) with navigation
  - Complete upload-to-mapped pipeline UI flow
affects: [05-validation-engine, 06-results-dashboard]

tech-stack:
  added: []
  patterns: [client-component-orchestrator, confidence-badge-display, status-badge-pattern, column-reorder-preview]

key-files:
  created:
    - src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx
    - src/components/files/column-mapping-table.tsx
    - src/components/files/data-preview-table.tsx
    - src/components/files/file-detail-view.tsx
    - src/components/files/parsing-warning-banner.tsx
  modified:
    - src/components/files/file-list.tsx
    - src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/page.tsx

key-decisions:
  - "FileDetailView as client orchestrator component managing mapping state, parse fetch, and confirm/edit flow"
  - "Column reorder in preview: mapped first, unmapped second, ignored last"
  - "Confidence badges: green (high), yellow (medium), gray (low) using existing Badge component"

patterns-established:
  - "Client orchestrator pattern: server page fetches data, client component manages interactive state"
  - "Status badge pattern: color-coded badges for entity lifecycle states"

requirements-completed: [FILE-03, FILE-04]

duration: 3min
completed: 2026-03-11
---

# Phase 4 Plan 03: Column Mapping UI Summary

**Interactive column mapping interface with confidence badges, data preview table with column reordering, and file status badges completing the upload-to-mapped pipeline flow**

## Performance

- **Duration:** 3 min (continuation -- checkpoint approval only)
- **Started:** 2026-03-11T03:59:14Z
- **Completed:** 2026-03-11T04:02:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7

## Accomplishments

- File detail page with auth, ownership checks, breadcrumbs, and file metadata display
- Column mapping table with dropdown selectors for all 14 survey column types, confidence badges, and ignore capability
- Data preview table showing first 50 rows with mapped columns first, unmapped second, ignored last
- Parsing warning banner with expandable details for parse issues and missing expected columns
- Confirm/Edit mappings flow saving to database and toggling read-only state
- File list updated with color-coded status badges and navigation links to file detail page
- End-to-end pipeline verified: upload -> auto-parse -> review mappings -> confirm

## Task Commits

Each task was committed atomically:

1. **Task 1: File detail page, mapping table, preview table, and warning banner** - `aa6865d` (feat)
2. **Task 2: Update file list with status badges and mapping navigation** - `e500ed9` (feat)
3. **Task 3: Verify ingestion pipeline end-to-end** - checkpoint approved (no commit)

## Files Created/Modified

- `src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/files/[fileId]/page.tsx` - Server page with auth, ownership check, breadcrumbs, renders FileDetailView
- `src/components/files/file-detail-view.tsx` - Client orchestrator managing parse fetch, mapping state, confirm/edit flow
- `src/components/files/column-mapping-table.tsx` - Interactive mapping table with dropdowns and confidence badges
- `src/components/files/data-preview-table.tsx` - Preview of first 50 rows with column reordering
- `src/components/files/parsing-warning-banner.tsx` - Amber warning banner with expandable parse issue details
- `src/components/files/file-list.tsx` - Updated with status badges and file detail navigation
- `src/app/(dashboard)/projects/[projectId]/jobs/[jobId]/page.tsx` - Updated to pass projectId/jobId to file list

## Decisions Made

- FileDetailView acts as client orchestrator: server page fetches dataset/job, client component manages all interactive state (mappings, preview, warnings, confirm/edit)
- Column reorder in preview table: mapped columns first, unmapped second, ignored last for clear visual hierarchy
- Confidence badges use green (high), yellow (medium), gray (low) colors with existing Badge component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete ingestion pipeline is operational: upload -> auto-parse -> column mapping -> confirm
- Phase 5 (Validation Engine) can consume confirmed column mappings from the database
- Dataset status tracking (uploaded/parsing/parsed/mapped/error) provides clear pipeline state

## Self-Check: PASSED

All 6 created/modified files verified on disk. Both task commits (aa6865d, e500ed9) verified in git log.

---
*Phase: 04-ingestion-pipeline*
*Completed: 2026-03-11*
