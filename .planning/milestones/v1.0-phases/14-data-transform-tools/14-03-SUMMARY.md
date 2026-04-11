---
phase: 14-data-transform-tools
plan: 03
subsystem: ui
tags: [react, transform, split, dropzone, state-machine, zip-download]

requires:
  - phase: 14-data-transform-tools
    provides: Backend split FastAPI endpoint with KP range and column value modes
  - phase: 14-data-transform-tools
    plan: 02
    provides: OutputPreviewTable component, state machine pattern, API proxy pattern
provides:
  - Split dataset tool UI at /tools/transform/split
  - API proxy route for split endpoint
  - Individual file download and Download All as ZIP
  - Client-side CSV header extraction for column mode
affects: [14-data-transform-tools]

tech-stack:
  added: []
  patterns: [ZIP blob download, individual file re-fetch with single_value/single_range, CSV header extraction]

key-files:
  created:
    - src/app/(dashboard)/tools/transform/split/page.tsx
    - src/app/(dashboard)/tools/transform/split/split-tool.tsx
    - src/app/api/transform/split/route.ts
  modified: []

key-decisions:
  - "Individual file download re-invokes /api/transform/split with single_value or single_range param rather than parsing ZIP client-side"
  - "CSV headers extracted from first 4KB of file for column dropdown"
  - "Preview updates to show whichever file the user last downloaded"

patterns-established:
  - "ZIP blob URL management with useRef and revokeObjectURL cleanup"
  - "Re-fetch pattern: same endpoint with narrowing params for individual file retrieval"

requirements-completed: [XFRM-10, XFRM-11]

duration: 5min
completed: 2026-03-30
---

# Phase 14 Plan 03: Split Tool UI Summary

**Split dataset tool with KP range and column value modes, individual file downloads, and ZIP export**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-30
- **Files modified:** 3

## Accomplishments
- Split tool with full state machine: upload → configure → splitting → done → error
- Two split modes: by column value (dropdown from CSV headers) and by KP range (dynamic range list with add/remove)
- Output format selector defaulting to input file extension with GeoJSON fallback
- Download All as ZIP button using blob URL
- Individual file download via re-fetch with single_value/single_range params
- Preview table updates to show most recently downloaded file
- Client-side CSV header extraction from first 4KB for column dropdown

## Task Commits

1. **Split dataset tool with KP range and column value modes** - `13bd33b` (feat)

## Files Created
- `src/app/(dashboard)/tools/transform/split/page.tsx` - Split tool page wrapper
- `src/app/(dashboard)/tools/transform/split/split-tool.tsx` - Split tool with two modes, ZIP download, individual file downloads
- `src/app/api/transform/split/route.ts` - Auth proxy for split endpoint

## Deviations from Plan

None - plan executed as written.

## Issues Encountered
None

## Next Phase Readiness
- All three transform tools (CRS, merge, split) complete
- Phase 14 fully delivered

---
*Phase: 14-data-transform-tools*
*Completed: 2026-03-30*
