---
phase: 14-data-transform-tools
plan: 02
subsystem: ui
tags: [react, transform, crs, merge, dropzone, state-machine]

requires:
  - phase: 14-data-transform-tools
    provides: Backend CRS conversion, merge, and split FastAPI endpoints
  - phase: 12-format-conversion
    provides: Auth proxy pattern, converter state machine pattern, react-dropzone inline pattern
provides:
  - CRS conversion tool UI at /tools/transform/crs
  - Merge datasets tool UI at /tools/transform/merge
  - Shared OutputPreviewTable component for transform output
  - API proxy routes for CRS and merge endpoints
  - Updated transform landing page with clickable cards
affects: [14-data-transform-tools]

tech-stack:
  added: []
  patterns: [multi-file dropzone upload, state machine with preview table, dual text/blob response reading]

key-files:
  created:
    - src/app/(dashboard)/tools/transform/crs/page.tsx
    - src/app/(dashboard)/tools/transform/crs/crs-tool.tsx
    - src/app/(dashboard)/tools/transform/merge/page.tsx
    - src/app/(dashboard)/tools/transform/merge/merge-tool.tsx
    - src/components/transform/output-preview-table.tsx
    - src/app/api/transform/crs/route.ts
    - src/app/api/transform/merge/route.ts
  modified:
    - src/app/(dashboard)/tools/transform/page.tsx

key-decisions:
  - "OutputPreviewTable as lightweight shared component (not reusing data-preview-table.tsx which is coupled to mapping workflow)"
  - "Dual text/blob response reading: read response as text for preview, create blob from text for download"
  - "Multi-file FormData: append each file as 'files' field for FastAPI List[UploadFile] compatibility"

patterns-established:
  - "Multi-file dropzone: noClick when files exist, separate open() for Add More button"
  - "Transform tool state machine: upload -> configure/preview -> processing -> done (with preview table) -> error"
  - "Format default detection: match input extension, fallback to GeoJSON"

requirements-completed: [XFRM-07, XFRM-08, XFRM-09]

duration: 4min
completed: 2026-03-30
---

# Phase 14 Plan 02: CRS & Merge Tool UI Summary

**CRS conversion and merge dataset tools with state machine UI, shared output preview table, and API proxy routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T00:07:49Z
- **Completed:** 2026-03-30T00:12:11Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Transform landing page updated with clickable cards linking to tool sub-pages, Auto-Clean showing Coming Soon badge
- CRS conversion tool with upload, source/target CRS selection, output format defaulting to same-as-input, coordinate transform, preview of first 20 rows, and download
- Merge datasets tool with multi-file upload, file list management, output format selection, merge, preview table, and download
- Shared OutputPreviewTable component with CSV parsing, truncation, and row limiting for reuse by split tool

## Task Commits

Each task was committed atomically:

1. **Task 1: Landing page update, API proxy routes, and shared preview table** - `9802ff7` (feat)
2. **Task 2: CRS conversion and merge tool pages** - `fe00959` (feat)

## Files Created/Modified
- `src/app/(dashboard)/tools/transform/page.tsx` - Updated landing page with clickable cards and Coming Soon badge
- `src/app/(dashboard)/tools/transform/crs/page.tsx` - CRS tool page wrapper with breadcrumb
- `src/app/(dashboard)/tools/transform/crs/crs-tool.tsx` - CRS conversion tool with 5-step state machine
- `src/app/(dashboard)/tools/transform/merge/page.tsx` - Merge tool page wrapper with breadcrumb
- `src/app/(dashboard)/tools/transform/merge/merge-tool.tsx` - Merge datasets tool with multi-file upload
- `src/components/transform/output-preview-table.tsx` - Shared preview table component (first 20 rows)
- `src/app/api/transform/crs/route.ts` - Auth proxy for CRS endpoint
- `src/app/api/transform/merge/route.ts` - Auth proxy for merge endpoint

## Decisions Made
- OutputPreviewTable is a new lightweight component rather than reusing data-preview-table.tsx (too coupled to mapping workflow per RESEARCH.md)
- Response read as text first for preview, then converted to blob for download (dual-read pattern)
- Multi-file upload uses noClick when files exist to prevent accidental re-open, with separate "Add More" button via open()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CRS and merge tools complete, ready for Plan 03 (split tool)
- OutputPreviewTable component ready for reuse by split tool
- Split card on landing page already links to /tools/transform/split

---
*Phase: 14-data-transform-tools*
*Completed: 2026-03-30*
