---
phase: 14-data-transform-tools
plan: 01
subsystem: api
tags: [pyproj, crs, transform, merge, split, fastapi, geospatial]

requires:
  - phase: 11-file-format-parsers
    provides: "ParseResult dataclass and dispatch_parser registry"
  - phase: 12-format-conversion
    provides: "WRITERS dict, _coords.py helpers, conversion router pattern"
provides:
  - "CRS coordinate transformation (transform_crs)"
  - "CRS auto-detection heuristics (detect_crs_from_values, utm_zone_from_lonlat)"
  - "Dataset merge with union columns (merge_datasets)"
  - "Dataset split by KP range and column value (split_by_kp, split_by_column)"
  - "FastAPI transform endpoints (/api/v1/transform/crs, /merge, /split)"
affects: [14-data-transform-tools, frontend-transform-pages]

tech-stack:
  added: [pyproj]
  patterns: [transform-function-pattern, zip-archive-response, single-value-retrieval]

key-files:
  created:
    - backend/app/transforms/__init__.py
    - backend/app/transforms/_detect_crs.py
    - backend/app/transforms/crs.py
    - backend/app/transforms/merge.py
    - backend/app/transforms/split.py
    - backend/app/routers/transform.py
    - backend/tests/transforms/test_detect_crs.py
    - backend/tests/transforms/test_crs.py
    - backend/tests/transforms/test_merge.py
    - backend/tests/transforms/test_split.py
    - backend/tests/test_transform_endpoint.py
  modified:
    - backend/requirements.txt
    - backend/app/main.py

key-decisions:
  - "Import WRITERS from conversion router (no duplication)"
  - "Default output format matches input extension, fallback to GeoJSON"
  - "Split returns ZIP for multiple outputs, single file for single_value/single_range"
  - "CRS detection heuristics: WGS84 [-180,180]/[-90,90], OSGB36 [0,700000]/[0,1300000], UTM ambiguous returns None"

patterns-established:
  - "Transform function signature: (ParseResult, ...) -> tuple[ParseResult, list[str]] with warnings"
  - "ZIP archive response for multi-file split output"
  - "single_value/single_range params for individual file retrieval from split"
  - "default_target_format helper for same-as-input format defaulting"

requirements-completed: [XFRM-01, XFRM-02, XFRM-03, XFRM-04, XFRM-05, XFRM-06]

duration: 5min
completed: 2026-03-30
---

# Phase 14 Plan 01: Backend Transform Functions and Endpoints Summary

**CRS conversion via pyproj, dataset merge with union columns, split by KP/column with ZIP output and single-file retrieval endpoints**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T00:01:22Z
- **Completed:** 2026-03-30T00:05:54Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- CRS auto-detection heuristics identify WGS84, OSGB36, and UTM coordinate ranges
- CRS coordinate transformation using pyproj with always_xy=True
- Dataset merge with union column headers and missing-value padding
- Dataset split by KP range (inclusive start, exclusive end) and column value grouping
- Three FastAPI endpoints with default-format-matches-input behavior and ZIP multi-file output
- 38 tests passing (25 unit + 13 integration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Transform functions with TDD tests** - `26163f5` (test: RED), `c7da015` (feat: GREEN)
2. **Task 2: FastAPI transform router and endpoint tests** - `29bc121` (feat)

_TDD task had separate RED/GREEN commits._

## Files Created/Modified
- `backend/app/transforms/__init__.py` - Package init
- `backend/app/transforms/_detect_crs.py` - CRS auto-detection heuristics
- `backend/app/transforms/crs.py` - CRS coordinate transformation
- `backend/app/transforms/merge.py` - Dataset merge with union columns
- `backend/app/transforms/split.py` - Dataset split by KP range and column value
- `backend/app/routers/transform.py` - FastAPI endpoints for CRS, merge, split
- `backend/app/main.py` - Router registration
- `backend/requirements.txt` - Added pyproj>=3.7
- `backend/tests/transforms/test_detect_crs.py` - CRS detection tests
- `backend/tests/transforms/test_crs.py` - CRS transform tests
- `backend/tests/transforms/test_merge.py` - Merge tests
- `backend/tests/transforms/test_split.py` - Split tests
- `backend/tests/test_transform_endpoint.py` - Endpoint integration tests

## Decisions Made
- Imported WRITERS dict from conversion router to avoid duplication
- Default output format matches input file extension, falling back to GeoJSON
- Split returns ZIP archive for multiple outputs, single file for single_value/single_range retrieval
- CRS detection: WGS84 if lon [-180,180] and lat [-90,90]; OSGB36 if easting [0,700000] and northing [0,1300000]; UTM ambiguous returns None requiring user to specify

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend transform functions and endpoints ready for frontend integration
- Plans 14-02 and 14-03 can build frontend pages calling these endpoints

## Self-Check: PASSED

All 11 created files verified on disk. All 3 commit hashes found in git log.

---
*Phase: 14-data-transform-tools*
*Completed: 2026-03-30*
