---
phase: 27-spatial-qc-map-overlay
plan: 02
subsystem: ui
tags: [leaflet, react-leaflet, spatial, heatmap, map, circleMarker, dataset-comparison]

requires:
  - phase: 27-spatial-qc-map-overlay (plan 01)
    provides: coordinate extractor, severity colors, dataset comparison engine, spatial types
  - phase: 16-pipeline-workflow
    provides: pipeline state machine and stage-validate component
provides:
  - SpatialQCMap component with issue markers, heatmap toggle, and comparison overlay
  - IssueMarkersLayer with severity-colored CircleMarkers and detail popups
  - HeatmapLayer using leaflet.heat with gradient from green to red
  - ComparisonLayer showing matched dataset pairs with deviation-colored lines
  - Map tab in ResultsDashboard for spatial issue visualization
  - View on Map button in pipeline StageValidate
affects: [results-dashboard, pipeline-workflow, validation-engine]

tech-stack:
  added: [leaflet.heat]
  patterns: [dynamic import ssr:false for map components, canvas renderer for performance, adapter pattern for pipeline ValidationIssue conversion]

key-files:
  created:
    - src/components/spatial-qc/issue-markers-layer.tsx
    - src/components/spatial-qc/heatmap-layer.tsx
    - src/components/spatial-qc/comparison-layer.tsx
    - src/components/spatial-qc/spatial-qc-map.tsx
  modified:
    - src/components/files/results-dashboard.tsx
    - src/components/files/file-detail-view.tsx
    - src/app/(dashboard)/pipeline/components/stage-validate.tsx
    - src/app/(dashboard)/pipeline/lib/pipeline-state.ts

key-decisions:
  - "Easting/northing passed as lat/lng directly (caller responsible for CRS conversion)"
  - "Canvas renderer (preferCanvas: true) for performance with 500+ markers"
  - "Pipeline adapter constructs ColumnMapping[] from header name heuristics for spatial detection"
  - "Stopped auto-advance to Review stage so users see validation results, map, and AI summary first"

patterns-established:
  - "Adapter pattern: pipeline client-side ValidationIssue to server-compatible shape for spatial extraction"
  - "Header-based spatial column detection for pipeline context where ColumnMapping objects unavailable"

requirements-completed: [SQCV-01, SQCV-02, SQCV-03]

duration: 8min
completed: 2026-04-11
---

# Phase 27 Plan 02: Spatial QC Map Components Summary

**Severity-colored issue markers, toggleable heatmap overlay, and dual-dataset comparison layer wired into both results dashboard and pipeline validate stage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-11T14:34:00Z
- **Completed:** 2026-04-11T16:15:00Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 8

## Accomplishments
- Built four spatial QC map components: IssueMarkersLayer, HeatmapLayer, ComparisonLayer, and SpatialQCMap orchestrator
- Integrated map visualization into ResultsDashboard as a Map view tab with severity filtering and dataset comparison dropdown
- Added "View on Map" collapsible panel in pipeline StageValidate with automatic spatial column detection from headers
- Human-verified: markers, heatmap, and popups all working correctly in both contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Map sub-components (markers, heatmap, comparison layers)** - `3a4209e` (feat)
2. **Task 2: Wire SpatialQCMap into ResultsDashboard and Pipeline StageValidate** - `a9fded1` (feat)
3. **Task 3: Verify spatial QC map in dashboard and pipeline** - Human-verified (approved)

**Additional fix:** `b2142e6` - Stopped auto-advance to Review so users see Validate results + map first

## Files Created/Modified
- `src/components/spatial-qc/issue-markers-layer.tsx` - CircleMarker layer with severity-colored markers and detail popups
- `src/components/spatial-qc/heatmap-layer.tsx` - leaflet.heat wrapper with green-to-red gradient
- `src/components/spatial-qc/comparison-layer.tsx` - Dual-dataset overlay with deviation-colored polylines
- `src/components/spatial-qc/spatial-qc-map.tsx` - Main map component with layer toggles and auto-fit bounds
- `src/components/files/results-dashboard.tsx` - Added Map view tab with spatial issue extraction and comparison dropdown
- `src/components/files/file-detail-view.tsx` - Passes columnMappings prop to ResultsDashboard
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx` - Added View on Map button with collapsible map panel
- `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` - Pipeline state adjustments for map integration

## Decisions Made
- Canvas renderer (preferCanvas: true) for performance with large marker counts
- Pipeline adapter constructs ColumnMapping[] from header name heuristics when formal mappings unavailable
- Stopped auto-advance to Review stage so users can see validation results, map, and AI summary before proceeding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stopped auto-advance to Review after validation**
- **Found during:** Task 3 (human verification)
- **Issue:** Pipeline auto-advanced to Review stage after validation, preventing users from seeing results and map
- **Fix:** Removed auto-advance behavior so users stay on Validate stage to review results
- **Files modified:** src/app/(dashboard)/pipeline/lib/pipeline-state.ts
- **Verification:** Human confirmed users now see results and map on Validate stage
- **Committed in:** b2142e6

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential UX fix discovered during verification. No scope creep.

## Issues Encountered
None beyond the auto-advance fix noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spatial QC map overlay phase is now complete (both plans 01 and 02 done)
- All SQCV requirements fulfilled: issue markers (SQCV-01), heatmap (SQCV-02), dataset comparison (SQCV-03)
- Phase 27 is the final phase -- project milestone v1.0 is complete

## Self-Check: PASSED

- All 7 source files: FOUND
- Commit 3a4209e (Task 1): FOUND
- Commit a9fded1 (Task 2): FOUND
- Commit b2142e6 (auto-fix): FOUND

---
*Phase: 27-spatial-qc-map-overlay*
*Completed: 2026-04-11*
