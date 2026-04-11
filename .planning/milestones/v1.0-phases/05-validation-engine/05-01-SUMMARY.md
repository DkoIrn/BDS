---
phase: 05-validation-engine
plan: 01
subsystem: api
tags: [fastapi, python, pandas, scipy, validation, tdd]

# Dependency graph
requires:
  - phase: 04-ingestion-pipeline
    provides: parsed datasets with column mappings in Supabase
provides:
  - FastAPI backend scaffold with config, models, routers, services
  - 5 validation checks (range, missing data, duplicates, outliers, monotonicity)
  - Validation pipeline orchestrator
  - Plain-English explanation system with KP-referenced locations
  - Dockerfile for Railway deployment
affects: [06-validation-profiles, 07-async-processing, 08-results-dashboard]

# Tech tracking
tech-stack:
  added: [fastapi, uvicorn, pandas, numpy, scipy, supabase-py, pydantic-settings, pytest, pytest-cov]
  patterns: [validator-pipeline, pure-function-validators, tdd-red-green]

key-files:
  created:
    - backend/app/validators/base.py
    - backend/app/validators/range_check.py
    - backend/app/validators/missing_data.py
    - backend/app/validators/duplicates.py
    - backend/app/validators/outliers.py
    - backend/app/validators/monotonicity.py
    - backend/app/validators/explanations.py
    - backend/app/services/validation.py
    - backend/app/routers/validation.py
    - backend/app/main.py
    - backend/app/config.py
    - backend/app/models/schemas.py
    - backend/Dockerfile
  modified: []

key-decisions:
  - "Pure functions over classes for validators -- simpler, easier to test, no state"
  - "Dynamic KP gap threshold (median*3) when no explicit threshold provided"
  - "Generous default thresholds (DOB/DOC: 0-10m, depth: 0-500m) to avoid false positives"
  - "Sync def endpoints for supabase-py compatibility (not async def)"

patterns-established:
  - "Validator pattern: function(df, column, ..., kp_column) -> list[ValidationIssue]"
  - "Location formatting: format_location(kp_value, row_number) for consistent messages"
  - "Pipeline orchestration: run_validation_pipeline aggregates all validator results"

requirements-completed: [VALE-01, VALE-02, VALE-03, VALE-04, VALE-05, VALE-07]

# Metrics
duration: 14min
completed: 2026-03-11
---

# Phase 5 Plan 1: Validation Engine Summary

**FastAPI backend with 5 rule-based validators (range, missing, duplicates, outliers, monotonicity) using pandas/scipy, TDD with 34 passing tests, KP-referenced explanations**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-11T17:05:01Z
- **Completed:** 2026-03-11T17:19:00Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- Complete FastAPI backend scaffold with Pydantic config, models, router, and service layers
- 5 validation modules: range check with tolerance, missing data with KP gap detection, exact/near-duplicate detection, z-score and IQR outlier detection, KP monotonicity validation
- Validation pipeline orchestrator wiring all checks with configurable thresholds
- Plain-English explanation system with "At KP 12.450 (row 45)" location format and statistical context
- 34 unit tests across 6 test files, all passing (TDD RED then GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: FastAPI scaffold + base types + test fixtures + all validator tests (RED)** - `9c6a5fe` (test)
2. **Task 2: Implement all validators and pipeline (GREEN)** - `588778e` (feat)

## Files Created/Modified
- `backend/app/validators/base.py` - Severity enum, ValidationIssue dataclass, Validator protocol
- `backend/app/validators/range_check.py` - Range/tolerance validation (VALE-01)
- `backend/app/validators/missing_data.py` - Missing data and KP gap detection (VALE-02)
- `backend/app/validators/duplicates.py` - Duplicate and near-duplicate detection (VALE-03)
- `backend/app/validators/outliers.py` - Z-score and IQR outlier detection (VALE-04)
- `backend/app/validators/monotonicity.py` - KP monotonicity validation (VALE-05)
- `backend/app/validators/explanations.py` - Location formatting helper (VALE-07)
- `backend/app/services/validation.py` - Pipeline orchestrator
- `backend/app/routers/validation.py` - POST /api/v1/validate endpoint
- `backend/app/main.py` - FastAPI app with CORS and /health endpoint
- `backend/app/config.py` - Pydantic BaseSettings for env vars
- `backend/app/models/schemas.py` - Request/response Pydantic models
- `backend/app/dependencies.py` - Supabase client factory
- `backend/Dockerfile` - Docker image for Railway deployment
- `backend/pyproject.toml` - pytest configuration
- `backend/requirements.txt` - Python dependencies
- `backend/tests/conftest.py` - Shared fixtures with realistic survey data
- `backend/tests/validators/test_range_check.py` - 7 tests for range validation
- `backend/tests/validators/test_missing_data.py` - 6 tests for missing data
- `backend/tests/validators/test_duplicates.py` - 4 tests for duplicate detection
- `backend/tests/validators/test_outliers.py` - 6 tests for outlier detection
- `backend/tests/validators/test_monotonicity.py` - 5 tests for monotonicity
- `backend/tests/validators/test_explanations.py` - 6 tests for explanation quality

## Decisions Made
- Pure functions over classes for validators -- simpler to test and compose
- Dynamic KP gap threshold (median spacing * 3) adapts to each dataset's density when no explicit threshold given
- Generous default range thresholds (DOB/DOC: 0-10m, depth: 0-500m) to avoid false positives before Phase 6 adds configurable profiles
- Using sync `def` for FastAPI endpoints since supabase-py is synchronous (FastAPI runs in thread pool)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Python not installed on development machine**
- **Found during:** Task 1 (before test execution)
- **Issue:** Python was not available on the Windows machine -- only a Microsoft Store stub
- **Fix:** Downloaded and extracted Python 3.12.8 embedded distribution with pip bootstrap
- **Files modified:** None (system-level)
- **Verification:** `python --version` returns Python 3.12.8, all tests run
- **Committed in:** N/A (environment setup, not code change)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment setup was necessary to proceed. No scope creep.

## Issues Encountered
- `.env.example` was ignored by `.gitignore` pattern -- used `git add -f` to force-add it

## User Setup Required
None - no external service configuration required for this plan. Supabase tables (validation_runs, validation_issues) will be created in a later plan.

## Next Phase Readiness
- All 5 validators implemented and tested, ready for profile/template configuration (Phase 6)
- FastAPI app runs locally and serves /health endpoint
- Dockerfile ready for Railway deployment (Plan 05-03)
- Pipeline orchestrator ready for async processing integration (Phase 7)

---
*Phase: 05-validation-engine*
*Completed: 2026-03-11*
