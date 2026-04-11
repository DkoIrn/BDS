---
phase: 05-validation-engine
verified: 2026-03-12T00:00:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "Run backend test suite"
    expected: "All 34 tests pass: cd backend && python -m pytest -x --tb=short"
    why_human: "Python environment and dependencies must be installed on the machine; cannot run pytest in this verification context"
  - test: "Click Run QC on a mapped dataset and observe end-to-end flow"
    expected: "Progress spinner appears, then summary card shows critical/warning/info counts and pass rate. Status badge updates to Validated."
    why_human: "Requires a running browser session with FastAPI running locally or on Railway"
  - test: "Check Supabase for validation records after running QC"
    expected: "validation_runs table has a row with correct counts; validation_issues table has per-row issue records"
    why_human: "Requires access to Supabase dashboard or SQL client with real data"
  - test: "Verify Re-run Validation creates a new run and updates the display"
    expected: "Clicking Re-run from the summary card triggers a second validation run; summary updates with new results"
    why_human: "Requires browser interaction against the running application"
  - test: "Verify FASTAPI_URL is not exposed to the browser"
    expected: "No NEXT_PUBLIC_FASTAPI_URL in environment; FastAPI URL only used server-side in route.ts"
    why_human: "Runtime check — static grep confirms no public env var but actual browser network traffic should be inspected to confirm"
---

# Phase 5: Validation Engine Verification Report

**Phase Goal:** Rule-based validation engine — range checks, missing data, duplicates, outlier detection (Z-score/IQR), KP monotonicity — with human-readable explanations on every flag. FastAPI backend, DB schema for results, API proxy, and UI wiring.
**Verified:** 2026-03-12
**Status:** human_needed — all automated artifact and wiring checks pass; items requiring a running environment are flagged for human verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Range check flags values outside min/max with tolerance | VERIFIED | `backend/app/validators/range_check.py` — `check_range()` implements `effective_min/max`, iterates out-of-range via pandas, produces `Severity.CRITICAL` `ValidationIssue` with KP reference and tolerance annotation |
| 2 | Missing data check detects nulls, empty cells, and KP coverage gaps | VERIFIED | `backend/app/validators/missing_data.py` — `check_missing_data()` uses `isna() \| str.strip() == ""`, `check_kp_gaps()` diffs sorted KP with dynamic `median*3` threshold |
| 3 | Duplicate check catches exact duplicate rows and near-duplicate KP entries | VERIFIED | `backend/app/validators/duplicates.py` — `check_duplicate_rows()` uses `df.duplicated(keep=False)`, `check_near_duplicate_kp()` diffs sorted KP with configurable tolerance |
| 4 | Outlier detection finds statistical outliers via z-score and IQR | VERIFIED | `backend/app/validators/outliers.py` — `check_outliers_zscore()` uses `scipy.stats.zscore`, skips zero-std and small samples; `check_outliers_iqr()` uses quantile fences |
| 5 | Monotonicity check validates KP values are increasing | VERIFIED | `backend/app/validators/monotonicity.py` — `check_monotonicity()` diffs KP series, flags decreasing as `CRITICAL`, equal as `WARNING`, includes prev/current KP in message |
| 6 | Every flagged issue has a plain-English explanation with KP reference, expected vs actual | VERIFIED | `backend/app/validators/explanations.py` — `format_location()` produces `"At KP {kp:.3f} (row {row})"` or `"Row {row}"`. All validators use it; `expected` and `actual` fields populated on every `ValidationIssue` |
| 7 | Validation results stored in dedicated DB tables with per-cell granularity | VERIFIED | `supabase/migrations/00006_validation_tables.sql` — `validation_runs` and `validation_issues` tables with RLS, indexes on `dataset_id`, `run_id`, `severity` |
| 8 | Next.js API route proxies validation requests to FastAPI with auth and ownership checks | VERIFIED | `src/app/api/validate/route.ts` — checks `getUser()`, verifies `datasets.user_id == user.id`, sets status to `validating`, proxies to `${FASTAPI_URL}/api/v1/validate`, rolls back on error |
| 9 | UI shows Run QC button, progress indicator, and summary after validation | VERIFIED | `src/components/files/file-detail-view.tsx` — Run QC button conditionally rendered when `confirmed && !validating && datasetStatus === "mapped"`; `ValidationProgress` shown when `validating === true`; `ValidationSummary` shown when `datasetStatus === "validated" && validationRun` |

**Score:** 9/9 truths verified (automated checks)

---

## Required Artifacts

### Plan 05-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/validators/base.py` | `ValidationIssue`, `Severity`, `Validator` | VERIFIED | `Severity(str, Enum)` with CRITICAL/WARNING/INFO; `ValidationIssue` dataclass with all required fields; `Validator` Protocol defined |
| `backend/app/validators/range_check.py` | `check_range` function | VERIFIED | 57 lines; full implementation with tolerance, KP reference, directional messaging |
| `backend/app/validators/missing_data.py` | `check_missing_data`, `check_kp_gaps` | VERIFIED | Both functions present and substantive; dynamic gap threshold implemented |
| `backend/app/validators/duplicates.py` | `check_duplicate_rows`, `check_near_duplicate_kp` | VERIFIED | Both functions implemented with correct severity assignments |
| `backend/app/validators/outliers.py` | `check_outliers_zscore`, `check_outliers_iqr` | VERIFIED | Both methods; edge cases handled (zero std, < 3 points); statistical context in messages |
| `backend/app/validators/monotonicity.py` | `check_monotonicity` | VERIFIED | Handles decreasing (CRITICAL) and equal (WARNING); includes prev/current KP values |
| `backend/app/validators/explanations.py` | `format_location` helper | VERIFIED | 9 lines; correct format strings for KP and no-KP cases |
| `backend/app/services/validation.py` | `run_validation_pipeline` orchestrator | VERIFIED | 112 lines; imports all 5 validators, orchestrates per-column and KP-specific checks, aggregates results |
| `backend/app/main.py` | FastAPI app with `include_router` | VERIFIED | `FastAPI()` with CORS middleware, `include_router(validation_router)`, `/health` endpoint |
| `backend/tests/validators/test_range_check.py` | 7 test cases | VERIFIED | 7 substantive test methods testing boundary, direction, tolerance, KP reference, fallback |
| `backend/tests/conftest.py` | Shared fixtures | VERIFIED | `sample_df` (20 rows, realistic survey data), `sample_mappings`, `default_config` |

### Plan 05-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00006_validation_tables.sql` | `validation_runs` and `validation_issues` tables with RLS | VERIFIED | Both tables present with all specified columns, indexes on `dataset_id`/`run_id`/`severity`, RLS enabled with SELECT policies |
| `src/lib/types/validation.ts` | `ValidationRun`, `ValidationIssue`, `ValidationSeverity` | VERIFIED | All three types exported with correct field types |
| `src/app/api/validate/route.ts` | POST endpoint proxying to FastAPI | VERIFIED | `maxDuration = 120`, auth check, ownership check, status transitions, FastAPI proxy, error rollback |
| `src/lib/types/files.ts` | `DatasetStatus` extended with validation states | VERIFIED | `'uploaded' \| 'parsing' \| 'parsed' \| 'mapped' \| 'validating' \| 'validated' \| 'validation_error' \| 'error'` |
| `src/lib/actions/validation.ts` | `getValidationRuns`, `getValidationIssues` server actions | VERIFIED | Both functions present with ownership verification via dataset join; client-side severity sort implemented |

### Plan 05-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/files/validation-progress.tsx` | Progress indicator component | VERIFIED | `ValidationProgress` component with `Loader2` spinner and `statusText` prop; not a stub |
| `src/components/files/validation-summary.tsx` | Summary display with severity counts | VERIFIED | `ValidationSummary` with severity badges (critical/warning/info), total issues, pass rate, Re-run button |
| `src/components/files/file-detail-view.tsx` | Updated with Run QC button and validation state | VERIFIED | `handleRunValidation`, `handleRerun`, state for `validating`/`validationRun`/`validationError`/`datasetStatus`, on-mount load of existing run |
| `backend/railway.json` | Railway deployment config | VERIFIED | Correct schema with Dockerfile builder and `/health` healthcheck |

---

## Key Link Verification

### Plan 05-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/services/validation.py` | all 5 validator modules | explicit imports | WIRED | Lines 4-8: imports `check_range`, `check_missing_data`, `check_kp_gaps`, `check_duplicate_rows`, `check_near_duplicate_kp`, `check_outliers_zscore`, `check_outliers_iqr`, `check_monotonicity` — all called in `run_validation_pipeline` |
| `backend/app/routers/validation.py` | `backend/app/services/validation.py` | `run_validation_pipeline` call | WIRED | Line 9: imports `run_validation_pipeline`; line 79: calls it with `df`, `mappings`, `config` |
| `backend/app/main.py` | `backend/app/routers/validation.py` | `include_router` | WIRED | Line 21: `app.include_router(validation_router)` |

### Plan 05-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/validate/route.ts` | `FASTAPI_URL/api/v1/validate` | `fetch` POST | WIRED | Line 63: `fetch(\`${fastApiUrl}/api/v1/validate\`, { method: 'POST', ... })` — response parsed and returned |
| `src/app/api/validate/route.ts` | `supabase.from('datasets')` | ownership check and status update | WIRED | Lines 27-38: ownership check; lines 51-54: status update to `validating`; lines 77-83: rollback on error |

### Plan 05-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/files/file-detail-view.tsx` | `/api/validate` | `fetch` POST on Run QC click | WIRED | Line 197: `fetch("/api/validate", { method: "POST", ... })` inside `handleRunValidation` |
| `src/components/files/file-detail-view.tsx` | `getValidationRuns` server action | on-mount load for validated datasets | WIRED | Lines 246-250: `getValidationRuns(dataset.id)` called in `useEffect` when `dataset.status === "validated"` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VALE-01 | 05-01, 05-03 | Range and tolerance checks against configurable thresholds | SATISFIED | `check_range()` with `min_val`, `max_val`, `tolerance`; pipeline uses config thresholds and defaults |
| VALE-02 | 05-01, 05-03 | Missing data points, null cells, and KP coverage gaps | SATISFIED | `check_missing_data()` and `check_kp_gaps()` with dynamic threshold |
| VALE-03 | 05-01, 05-03 | Duplicate rows and near-duplicate KP entries | SATISFIED | `check_duplicate_rows()` and `check_near_duplicate_kp()` |
| VALE-04 | 05-01, 05-03 | Statistical outliers using z-score and IQR | SATISFIED | `check_outliers_zscore()` and `check_outliers_iqr()` with scipy |
| VALE-05 | 05-01, 05-03 | Monotonicity of KP values | SATISFIED | `check_monotonicity()` with CRITICAL for decrease, WARNING for equal |
| VALE-07 | 05-01, 05-02, 05-03 | Plain-English explanation on every flagged issue | SATISFIED | `format_location()` helper used across all validators; `expected` and `actual` fields on every `ValidationIssue`; messages include KP reference, expected range, actual value |

All 6 requirement IDs declared across plans 05-01, 05-02, and 05-03 are accounted for. No orphaned requirements for Phase 5.

Note: VALE-06 (validation templates) and VALE-08 (configurable thresholds UI) are correctly deferred to Phase 6 and do not appear in any Phase 5 plan.

---

## Anti-Patterns Found

No anti-patterns detected in any Phase 5 files:

- No `TODO`, `FIXME`, `XXX`, `HACK`, or `PLACEHOLDER` comments in `backend/app/**/*.py` or `src/components/files/validation-*.tsx`
- No stub implementations (`return []` bodies) remaining in validator modules
- `FASTAPI_URL` referenced only as `process.env.FASTAPI_URL` inside `src/app/api/validate/route.ts` (server-only) — no `NEXT_PUBLIC_` prefix exposure
- `validation-progress.tsx` renders a real spinner with `statusText` prop — not a placeholder div
- `validation-summary.tsx` renders real severity badges, counts, pass rate — not a placeholder

---

## Human Verification Required

### 1. Backend Test Suite

**Test:** Run `cd backend && python -m pytest -x --tb=short` from the project root
**Expected:** 34 tests pass across 6 test files (range_check, missing_data, duplicates, outliers, monotonicity, explanations). Zero failures.
**Why human:** Python and dependencies must be installed in the active environment. Cannot execute pytest within this static verification.

### 2. End-to-End Run QC Flow

**Test:** Navigate to a file with status "mapped" in the running application. Click "Run QC". Observe progress indicator, then summary card.
**Expected:** Spinner appears with "Running validation..." text. After completion (within ~30 seconds), a summary card shows Critical/Warning/Info badge counts and a pass rate percentage. Status badge in page header updates to "Validated".
**Why human:** Requires a running Next.js dev server, a running FastAPI instance (local or Railway), and a Supabase project with the migration applied.

### 3. Re-run Validation

**Test:** From the validation summary card, click "Re-run Validation". Observe that new results appear.
**Expected:** A new validation run is created. The summary card updates with the new run's data (run timestamp changes).
**Why human:** Requires browser interaction and a running backend.

### 4. Supabase Records Created

**Test:** After running QC, check the Supabase dashboard (or SQL: `SELECT * FROM validation_runs ORDER BY run_at DESC LIMIT 5;` and `SELECT count(*) FROM validation_issues WHERE run_id = '<run_id>';`).
**Expected:** `validation_runs` table has a row with `status = 'completed'`, correct `total_issues`, `critical_count`, `warning_count`, `info_count`, and `pass_rate`. `validation_issues` table has one row per flagged issue with `message`, `expected`, `actual`, `kp_value` populated.
**Why human:** Requires database access.

### 5. FastAPI Not Exposed to Browser

**Test:** Open browser DevTools Network tab. Trigger a validation run. Confirm no request from the browser goes directly to the FastAPI URL — all traffic should go through `/api/validate`.
**Expected:** Zero direct browser requests to `localhost:8000` or Railway FastAPI URL. Only the Next.js API route is called from the browser.
**Why human:** Runtime network traffic cannot be verified statically.

---

## Summary

All 9 observable truths are verified against actual code. All 15 required artifacts exist and are substantive (no stubs). All 5 key links are wired with real implementations — imports used, functions called, results consumed.

The phase delivered exactly what was specified: a pure-function Python validation engine with 5 rule types, KP-referenced plain-English explanations, a FastAPI endpoint that fetches and processes datasets from Supabase storage, a migration for result storage tables with RLS, a TypeScript proxy route with auth and ownership enforcement, and a frontend Run QC workflow with progress and summary display.

Five items require a human with a running environment to confirm the live end-to-end behavior. No automated checks failed.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_
