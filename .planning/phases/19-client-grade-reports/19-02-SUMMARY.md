---
phase: 19-client-grade-reports
plan: 02
title: "Frontend Report Mode Dropdown & Triage Forwarding"
subsystem: ui
tags: [pdf, dropdown, export, triage, proxy-route, executive-report, technical-report]
dependency_graph:
  requires:
    - phase: 19-client-grade-reports/01
      provides: [chart_builder.py, executive-mode, technical-mode, statement-of-quality, FastAPI mode/triage params]
  provides:
    - PDF report mode dropdown in ExportButtons (results dashboard)
    - PDF report mode dropdown in pipeline export stage
    - Next.js proxy route forwarding mode and triage params to FastAPI
  affects: [results-dashboard, pipeline-workflow, pdf-reports]
tech_stack:
  added: []
  patterns: [click-outside-dropdown, blob-url-download, triage-count-forwarding]
key_files:
  created: []
  modified:
    - src/app/api/reports/pdf/route.ts
    - src/components/files/export-buttons.tsx
    - src/app/(dashboard)/pipeline/components/stage-export.tsx
key_decisions:
  - "Dropdown with click-outside detection for PDF report mode selection"
  - "Fetch-based blob download (not window.open) for consistent download behavior"
  - "Triage counts computed from triageDecisions state and forwarded as query params"
patterns_established:
  - "Report dropdown pattern: relative container with absolute menu, useRef click-outside"
requirements_completed: [RPT-06]
metrics:
  duration: "4min"
  completed: "2026-04-09T12:35:37Z"
  tasks_completed: 3
  tasks_total: 3
  test_count: 0
  files_changed: 3
---

# Phase 19 Plan 02: Frontend Report Mode Dropdown & Triage Forwarding Summary

**PDF report dropdown with Executive/Technical mode selection in both results dashboard and pipeline export, with triage count forwarding through Next.js proxy**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T12:00:00Z
- **Completed:** 2026-04-09T12:35:37Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- Next.js proxy route forwards mode and triage query params to FastAPI backend
- ExportButtons in results dashboard now shows dropdown with Executive Report and Technical Report options
- Pipeline export stage computes triage decision counts from state and forwards them to the report API
- Both locations use consistent fetch-based blob download for reliable file downloads

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Next.js proxy route to forward mode and triage params** - `86ba738` (feat)
2. **Task 2: Convert ExportButtons and pipeline export to report mode dropdown** - `1b1fe1e` (feat)
3. **Task 3: Verify report downloads end-to-end** - checkpoint approved (human-verify, no commit)

## Files Created/Modified
- `src/app/api/reports/pdf/route.ts` - Proxy route now reads mode, triage_accepted/rejected/deferred params and forwards to FastAPI
- `src/components/files/export-buttons.tsx` - PDF button replaced with dropdown offering Executive and Technical report downloads
- `src/app/(dashboard)/pipeline/components/stage-export.tsx` - QC Report button replaced with dropdown, computes triage counts from pipeline state

## Decisions Made
- Dropdown with click-outside detection (useRef + useEffect) for PDF mode selection
- Fetch-based blob download instead of window.open for consistent download behavior across browsers
- Triage counts computed from triageDecisions state and forwarded as query params only when triage data exists

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 (Client-Grade Reports) is now fully complete
- Both backend (plan 01) and frontend (plan 02) delivered
- Executive and Technical report modes available in both results dashboard and pipeline export
- All 5 success criteria for Phase 19 met

---
*Phase: 19-client-grade-reports*
*Completed: 2026-04-09*
