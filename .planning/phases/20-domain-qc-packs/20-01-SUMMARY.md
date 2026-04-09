---
phase: 20-domain-qc-packs
plan: 01
subsystem: api
tags: [pydantic, validators, pipeline-qc, domain-packs, fastapi]

requires:
  - phase: 05-validation-engine
    provides: Validation pipeline, base validators, ValidationIssue contract
  - phase: 06-validation-profiles
    provides: ProfileConfig, EnabledChecks, templates, resolve_config
provides:
  - KP drift validator (check_kp_drift) for chainage error detection
  - Segment continuity validator (check_segment_continuity) for impossible distance detection
  - Extended RangeThreshold with tolerance field
  - Extended EnabledChecks with 15 booleans (kp_drift, segment_continuity)
  - Extended ProfileConfig with chain-aware fields
  - 4 domain QC packs replacing old column-type templates
  - TEMPLATE_METADATA with expectedColumns for frontend auto-suggestion
affects: [20-02-frontend-pack-selector, validation-profiles, pipeline-workflow]

tech-stack:
  added: []
  patterns: [chain-aware-validators, severity-override-per-pack, tolerance-based-range-check]

key-files:
  created:
    - backend/app/validators/kp_drift.py
    - backend/app/validators/segment_continuity.py
    - backend/tests/validators/test_kp_drift.py
    - backend/tests/validators/test_segment_continuity.py
  modified:
    - backend/app/models/schemas.py
    - backend/app/services/templates.py
    - backend/app/services/validation.py
    - backend/tests/validators/test_range_check.py
    - backend/tests/validators/test_enabled_checks.py

key-decisions:
  - "KP drift uses coordinate distance in km (projected: meters/1000, geographic: haversine approx) for consistent comparison with KP increments"
  - "Severity overrides per pack via string fields on ProfileConfig (not enum) for JSON serialization compatibility"
  - "RangeThreshold tolerance only flattened to config dict when > 0 to avoid polluting config with zero-value entries"

patterns-established:
  - "Chain-aware validator pattern: pure function with severity_override param, gated by enabled_checks in pipeline"
  - "Pack definition pattern: ProfileConfig with workflow-specific thresholds, TEMPLATE_METADATA with expectedColumns"

requirements-completed: [PACK-01, PACK-02, PACK-03, PACK-04]

duration: 5min
completed: 2026-04-09
---

# Phase 20 Plan 01: Domain QC Packs Backend Summary

**Two chain-aware validators (KP drift, segment continuity), extended schemas with tolerance/severity fields, and 4 domain QC packs replacing old column-type templates**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T20:37:21Z
- **Completed:** 2026-04-09T20:42:13Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- KP drift validator detects chainage errors by comparing KP increments against coordinate distances with configurable tolerance
- Segment continuity validator flags impossible distance jumps and KP backtracking between consecutive rows
- RangeThreshold extended with backward-compatible tolerance field (default 0.0)
- EnabledChecks expanded to 15 booleans with kp_drift and segment_continuity toggles
- 4 old column-type templates replaced with 3 workflow-specific domain packs + General catch-all
- TEMPLATE_METADATA includes expectedColumns for frontend auto-suggestion

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for KP drift and segment continuity** - `72bdcb8` (test)
2. **Task 1 (GREEN): Schema extensions + validators + pipeline wiring** - `9ab79fa` (feat)
3. **Task 2: Domain pack definitions + resolve_config update** - `8b08075` (feat)

## Files Created/Modified
- `backend/app/validators/kp_drift.py` - Cumulative KP drift validator with tolerance-based flagging
- `backend/app/validators/segment_continuity.py` - Segment continuity validator with backtracking detection
- `backend/app/models/schemas.py` - RangeThreshold.tolerance, EnabledChecks (15 bools), ProfileConfig chain fields
- `backend/app/services/templates.py` - 4 domain packs, TEMPLATE_METADATA with expectedColumns, resolve_config flattening
- `backend/app/services/validation.py` - Pipeline wiring for kp_drift and segment_continuity gated by enabled_checks
- `backend/tests/validators/test_kp_drift.py` - 4 test cases for KP drift detection
- `backend/tests/validators/test_segment_continuity.py` - 3 test cases for segment continuity
- `backend/tests/validators/test_range_check.py` - Extended with tolerance band tests
- `backend/tests/validators/test_enabled_checks.py` - Extended with kp_drift and segment_continuity gating tests

## Decisions Made
- KP drift uses coordinate distance in km (projected: meters/1000, geographic: haversine approx) for consistent KP comparison
- Severity overrides stored as string fields on ProfileConfig for JSON serialization compatibility
- RangeThreshold tolerance only flattened to config when > 0 to keep config clean
- Pipeline wiring guards on kp_column presence before chain-aware checks (same pattern as existing KP-specific checks)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `tests/parsers/test_parse_dispatch.py::TestDispatchParser::test_unsupported_extension_raises` (unrelated to Phase 20 changes). Logged to deferred-items.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend pack definitions and validators ready for frontend consumption
- TEMPLATE_METADATA expectedColumns available for auto-suggestion UI
- resolve_config flattens all new fields for validation pipeline consumption
- Frontend plan (20-02) can proceed with pack selector UI, threshold editor chain checks group, and auto-suggestion banner

---
*Phase: 20-domain-qc-packs*
*Completed: 2026-04-09*
