---
phase: 23-one-click-data-fixes
plan: 01
subsystem: pipeline
tags: [tdd, data-cleaning, interpolation, deduplication, spike-detection, vitest]

requires:
  - phase: 16-pipeline-workflow
    provides: pipeline state machine and stage architecture
provides:
  - FixPreview, FixResult, UndoEntry type definitions
  - 6 fix functions (preview + apply for fill missing, remove duplicates, smooth spikes)
  - Exported findKpColumn and detectNumericColumns utilities from auto-clean.ts
affects: [23-02 (fix UI components), stage-clean integration]

tech-stack:
  added: []
  patterns: [preview-then-apply fix pattern, deep-copy immutability for undo snapshots]

key-files:
  created:
    - src/app/(dashboard)/pipeline/lib/fix-types.ts
    - src/app/(dashboard)/pipeline/lib/fix-engine.ts
    - tests/pipeline/fix-engine.test.ts
  modified:
    - src/app/(dashboard)/pipeline/lib/auto-clean.ts

key-decisions:
  - "Preview functions compute diffs without mutation; apply functions use deep-copy for immutability"
  - "Spike test data requires 30+ rows for z-score > 4 threshold to trigger reliably"

patterns-established:
  - "Preview-then-apply: each fix type has preview (read-only) and apply (returns FixResult with undo snapshot)"
  - "Deep copy via data.map(row => [...row]) for undo snapshots"

requirements-completed: [CLEN-01, CLEN-02, CLEN-03, CLEN-04]

duration: 4min
completed: 2026-04-10
---

# Phase 23 Plan 01: One-Click Fix Engine Summary

**TDD fix engine with 6 functions (preview + apply) for fill missing, remove duplicates, and smooth spikes -- extracted from auto-clean.ts algorithms**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T20:20:51Z
- **Completed:** 2026-04-10T20:24:57Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Created FixPreview, FixResult, UndoEntry type definitions in fix-types.ts
- Implemented 6 fix functions reusing algorithms from auto-clean.ts (interpolateGaps, removeDuplicates, removeSpikes)
- Exported findKpColumn and detectNumericColumns from auto-clean.ts for reuse
- 18 unit tests passing covering all fix types, immutability, and edge cases

## Task Commits

Each task was committed atomically:

1. **TDD RED: failing tests + types** - `b54f128` (test)
2. **TDD GREEN: fix-engine implementation** - `d399ded` (feat)

## Files Created/Modified
- `src/app/(dashboard)/pipeline/lib/fix-types.ts` - FixType, FixPreview, FixResult, UndoEntry type definitions
- `src/app/(dashboard)/pipeline/lib/fix-engine.ts` - 6 fix functions (preview + apply for 3 fix types)
- `src/app/(dashboard)/pipeline/lib/auto-clean.ts` - Exported findKpColumn and detectNumericColumns
- `tests/pipeline/fix-engine.test.ts` - 18 unit tests for all fix functions

## Decisions Made
- Preview functions compute diffs without mutation; apply functions deep-copy input for undoSnapshot
- Spike detection test data needs 30+ rows so z-score exceeds threshold of 4.0 (10 rows caused z=3.0 which is below threshold)
- computeInterpolation extracted as private helper in fix-engine.ts (same algorithm as auto-clean.ts interpolateGaps)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spike test data too small for z-score threshold**
- **Found during:** TDD GREEN (test verification)
- **Issue:** 10-row test data with spike value 9999 produced z-score of exactly 3.0 (below 4.0 threshold) due to extreme value skewing mean/stddev
- **Fix:** Increased test data to 30 rows with moderate spike value (500) producing z-score 5.38
- **Files modified:** tests/pipeline/fix-engine.test.ts
- **Verification:** All 18 tests pass
- **Committed in:** d399ded (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test data adjustment for statistical correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fix engine ready for UI integration in plan 23-02
- fix-types.ts exports available for fix-preview-modal and fix-action-bar components
- All 6 functions tested and verified

---
*Phase: 23-one-click-data-fixes*
*Completed: 2026-04-10*
