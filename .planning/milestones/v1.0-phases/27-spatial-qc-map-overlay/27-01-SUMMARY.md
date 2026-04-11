---
phase: 27-spatial-qc-map-overlay
plan: 01
subsystem: ui
tags: [leaflet, spatial, qc, haversine, coordinates, heatmap]

requires:
  - phase: 05-validation-engine
    provides: ValidationIssue and ValidationSeverity types
  - phase: 04-ingestion-pipeline
    provides: ColumnMapping and SurveyColumnType from parsing types
provides:
  - SpatialIssue, SpatialDataPoint, ComparisonPair, ComparisonResult type interfaces
  - Coordinate extraction from validation issues + parsedData + columnMappings
  - hasSpatialColumns guard for detecting lat/lon or easting/northing pairs
  - Severity to marker color and heatmap intensity mappings
  - KP-based dataset matching with Haversine deviation computation
  - leaflet.heat TypeScript type declarations
affects: [27-02-map-components, spatial-qc-ui]

tech-stack:
  added: [leaflet.heat]
  patterns: [pure-function-library, tdd-red-green, coordinate-extraction-from-column-mappings]

key-files:
  created:
    - src/components/spatial-qc/lib/types.ts
    - src/components/spatial-qc/lib/coordinate-extractor.ts
    - src/components/spatial-qc/lib/coordinate-extractor.test.ts
    - src/components/spatial-qc/lib/severity-colors.ts
    - src/components/spatial-qc/lib/severity-colors.test.ts
    - src/components/spatial-qc/lib/dataset-comparison.ts
    - src/components/spatial-qc/lib/dataset-comparison.test.ts
    - src/components/spatial-qc/lib/leaflet-heat.d.ts
  modified: []

key-decisions:
  - "Easting/northing passed as lat/lng directly (caller responsible for CRS conversion)"
  - "Greedy nearest-first KP matching: each B point matched at most once"
  - "Points without KP values placed in unmatched arrays rather than erroring"

patterns-established:
  - "Coordinate extraction: cross-reference row_number with parsedData using column mappings"
  - "Spatial column detection: hasSpatialColumns guard checks for coordinate pairs"

requirements-completed: [SQCV-01, SQCV-02, SQCV-03]

duration: 4min
completed: 2026-04-11
---

# Phase 27 Plan 01: Spatial QC Library Modules Summary

**Pure-function coordinate extraction, severity color mappings, and KP-based dataset comparison with Haversine deviation -- 34 tests passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T14:28:50Z
- **Completed:** 2026-04-11T14:32:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Coordinate extractor resolves lat/lng from parsedData rows using column mappings, supporting both lat/lon and easting/northing
- Severity color and heatmap intensity mappings for critical/warning/info severity levels
- Dataset comparison engine matches by nearest KP with configurable tolerance and computes Haversine deviation in meters
- Full TDD coverage with 34 tests across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Type definitions, coordinate extractor, and severity colors with TDD** - `ffb14b4` (feat)
2. **Task 2: Dataset comparison engine with TDD** - `a2f2f87` (feat)

## Files Created/Modified
- `src/components/spatial-qc/lib/types.ts` - SpatialIssue, SpatialDataPoint, ComparisonPair, ComparisonResult interfaces
- `src/components/spatial-qc/lib/coordinate-extractor.ts` - extractSpatialIssues, extractSpatialPoints, hasSpatialColumns
- `src/components/spatial-qc/lib/coordinate-extractor.test.ts` - 23 tests for coordinate extraction and spatial column detection
- `src/components/spatial-qc/lib/severity-colors.ts` - SEVERITY_MARKER_COLORS, SEVERITY_HEAT_INTENSITY, getSeverityColor
- `src/components/spatial-qc/lib/severity-colors.test.ts` - 9 tests for severity color mappings
- `src/components/spatial-qc/lib/dataset-comparison.ts` - matchDatasetsByKP, computeDeviations with Haversine formula
- `src/components/spatial-qc/lib/dataset-comparison.test.ts` - 11 tests for KP matching and deviation computation
- `src/components/spatial-qc/lib/leaflet-heat.d.ts` - TypeScript type declarations for leaflet.heat plugin

## Decisions Made
- Easting/northing passed as lat/lng directly -- caller responsible for CRS conversion to avoid coupling
- Greedy nearest-first KP matching ensures each B point matched at most once
- Points without KP values placed in unmatched arrays rather than throwing errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All library modules ready for Plan 02 map components
- leaflet.heat installed with type declarations
- Types exported for consumption by React components

---
*Phase: 27-spatial-qc-map-overlay*
*Completed: 2026-04-11*
