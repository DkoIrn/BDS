---
phase: 06-validation-profiles
verified: 2026-03-12T08:07:57Z
status: gaps_found
score: 12/13 must-haves verified
gaps:
  - truth: "TypeScript ProfileConfig type mirrors Python ProfileConfig exactly"
    status: partial
    reason: "general-survey template thresholds differ between Python and TypeScript. Python: dob={0,10}, easting={100000,900000}. TypeScript: dob={-10,20}, easting={0,1000000}. Also depth differs: Python max=500, TypeScript max=1000."
    artifacts:
      - path: "src/lib/validation/templates.ts"
        issue: "general-survey template uses different threshold values than backend/app/services/templates.py for dob, doc, and easting ranges"
    missing:
      - "Align src/lib/validation/templates.ts general-survey config: dob {0,10}, doc {0,10}, depth {0,500}, easting {100000,900000} to match Python DEFAULT_TEMPLATES['general-survey']"
human_verification:
  - test: "End-to-end profile flow"
    expected: "Profile dropdown auto-selects correct template, thresholds customize correctly, save/edit/delete works, Run QC sends config, results reflect chosen thresholds"
    why_human: "Plan 03 Task 3 is a blocking human checkpoint. SUMMARY.md records 'Human verified end-to-end flow' but no human sign-off artifact was captured in the phase directory."
---

# Phase 6: Validation Profiles Verification Report

**Phase Goal:** Validation profile system — configurable templates, threshold customization, and profile management for survey-specific validation rules
**Verified:** 2026-03-12T08:07:57Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 4 default templates (DOB, DOC, TOP, General) produce distinct config dicts with different thresholds | VERIFIED | `DEFAULT_TEMPLATES` in `backend/app/services/templates.py`: dob-survey has `dob:{0,5}`, doc-survey has `doc:{0,3}`, top-survey has `top:{-200,200}`, general-survey has 9 range types. Confirmed distinct by inspection. |
| 2 | Validation pipeline respects enabled_checks toggles — disabled checks produce zero issues | VERIFIED | `run_validation_pipeline` in `backend/app/services/validation.py` wraps every validator in `checks.get("check_name", True)` guards. 6 tests in `backend/tests/validators/test_enabled_checks.py` cover all 8 toggles including all-disabled returns empty. |
| 3 | Config snapshot is stored on every validation_runs record | VERIFIED | `backend/app/routers/validation.py` line 97: `"config_snapshot": profile_config.model_dump()` in the Supabase insert. Migration `00007_validation_profiles.sql` adds `config_snapshot JSONB` column. |
| 4 | ProfileConfig Pydantic model rejects invalid configs (min > max, negative z-score) | VERIFIED | `RangeThreshold.min_must_not_exceed_max` model_validator and `ProfileConfig.validate_thresholds` model_validator implemented. 10 tests in `backend/tests/test_schemas.py` cover both rejection cases. |
| 5 | TypeScript ProfileConfig type mirrors Python ProfileConfig exactly | PARTIAL FAIL | Specific templates (DOB, DOC, TOP) match. general-survey template diverges: Python uses `dob:{0,10}`, `doc:{0,10}`, `depth:{0,500}`, `easting:{100000,900000}`; TypeScript uses `dob:{-10,20}`, `doc:{-10,20}`, `depth:{0,1000}`, `easting:{0,1000000}`. This means a user selecting "General Survey" will see different threshold defaults in the UI vs what would be applied if no config were passed to FastAPI. |
| 6 | 4 default templates available as client-side constants with correct thresholds | PARTIAL | DOB, DOC, TOP match Python exactly. General Survey thresholds differ (see truth 5). |
| 7 | Profile CRUD server actions enforce user ownership via getUser() | VERIFIED | All 4 actions in `src/lib/actions/profiles.ts` call `supabase.auth.getUser()` and filter queries with `.eq('user_id', user.id)`. |
| 8 | API validate route forwards config object to FastAPI | VERIFIED | `src/app/api/validate/route.ts` line 67: `body: JSON.stringify({ dataset_id: datasetId, config: config ?? null })`. |
| 9 | suggestProfile function returns correct template based on column mappings | VERIFIED | `suggestProfile` in `src/lib/validation/templates.ts` implements dob > doc > top > general priority chain, confirmed by inspection. |
| 10 | User can select from 4 default templates in a grouped dropdown (DEFAULTS section) | VERIFIED | `ProfileSelector` renders `SelectGroup` with `SelectLabel="DEFAULTS"` iterating `DEFAULT_TEMPLATES`. |
| 11 | User can customize thresholds in an inline expansion panel below the dropdown | VERIFIED | `ThresholdEditor` (283 lines) renders Range Thresholds, Statistical Settings, KP Settings, and Enabled Checks sections. `ProfileSelector` conditionally renders it when `customizeOpen` is true. |
| 12 | Invalid configs (min > max, negative z-score) show inline errors and disable Run QC | VERIFIED | `validateConfig` in `file-detail-view.tsx` runs on every config change, stores errors in `configErrors`. Run QC button has `disabled={Object.keys(configErrors).length > 0}`. `ThresholdEditor` renders errors inline. |
| 13 | Run QC sends the resolved config to the API | VERIFIED | `handleRunValidation` in `file-detail-view.tsx` sends `body: JSON.stringify({ datasetId: dataset.id, config: currentConfig ?? undefined })`. |

**Score:** 12/13 truths verified (1 partial failure on general-survey threshold parity)

---

### Required Artifacts

| Artifact | Provided | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00007_validation_profiles.sql` | validation_profiles table with RLS, config_snapshot column on validation_runs | VERIFIED | Creates table with UUID PK, user_id FK, RLS policies for SELECT/INSERT/UPDATE/DELETE, `ALTER TABLE validation_runs ADD COLUMN config_snapshot JSONB`, updated_at trigger |
| `backend/app/services/templates.py` | 4 default template definitions as Python constants | VERIFIED | `DEFAULT_TEMPLATES` dict with 4 `ProfileConfig` instances, `resolve_config` helper, `TEMPLATE_METADATA` list |
| `backend/app/models/schemas.py` | ProfileConfig, EnabledChecks, RangeThreshold Pydantic models | VERIFIED | All 3 classes present with model_validators. `ValidateRequest` extended with `config: ProfileConfig | None = None` |
| `backend/app/services/validation.py` | run_validation_pipeline with enabled_checks filtering | VERIFIED | Signature includes `enabled_checks: dict | None = None`. All 8 check types wrapped in `checks.get(key, True)` guards |
| `backend/app/routers/validation.py` | Config passthrough from request, config_snapshot storage | VERIFIED | Uses `request.config or ProfileConfig()`, calls `resolve_config`, passes both args to pipeline, stores `config_snapshot: profile_config.model_dump()` |
| `src/lib/types/validation.ts` | Extended ValidationRun type with config_snapshot and profile_id | VERIFIED | `config_snapshot: ProfileConfig | null` and `profile_id: string | null` added to `ValidationRun`. `ProfileConfig`, `ValidationTemplate`, `ValidationProfile` interfaces present |
| `src/lib/validation/templates.ts` | DEFAULT_TEMPLATES array, ProfileConfig type, suggestProfile function | VERIFIED | All exports present: `DEFAULT_TEMPLATES`, `getTemplateById`, `suggestProfile`, `DEFAULT_ENABLED_CHECKS`. Minor: general-survey thresholds diverge from Python |
| `src/lib/actions/profiles.ts` | Server actions for profile CRUD | VERIFIED | `getProfiles`, `createProfile`, `updateProfile`, `deleteProfile` all exported with `'use server'`, auth checks, ownership filtering, unique constraint error handling |
| `src/app/api/validate/route.ts` | Updated validate proxy that forwards config to FastAPI | VERIFIED | Accepts `config?: ProfileConfig` in request body, forwards `config: config ?? null` to FastAPI |
| `src/components/files/profile-selector.tsx` | Grouped dropdown with defaults/custom sections, auto-suggestion, CRUD controls | VERIFIED | 326 lines. Renders DEFAULTS and MY PROFILES `SelectGroup` sections. Edit/delete per profile, Save as Profile flow, Customize toggle |
| `src/components/files/threshold-editor.tsx` | Inline expandable panel with range inputs, statistical settings, check toggles | VERIFIED | 283 lines. Range Thresholds, Statistical Settings, KP Settings, Enabled Checks sections. Inline error display. Reset to Defaults button |
| `src/components/files/file-detail-view.tsx` | Updated orchestrator with profile state, config resolution, validation with config | VERIFIED | Imports `ProfileSelector`. Profile state managed (`selectedProfileId`, `currentConfig`, `userProfiles`, `configErrors`). Auto-suggest on mount via `useEffect`. Config validation gating Run QC |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/routers/validation.py` | `backend/app/services/validation.py` | config + enabled_checks passed to run_validation_pipeline | WIRED | Line 73: `run_validation_pipeline(df, mappings, flat_config, enabled_checks=enabled_checks)` — both args present |
| `backend/app/routers/validation.py` | `supabase validation_runs table` | config_snapshot stored on insert | WIRED | Line 97: `"config_snapshot": profile_config.model_dump()` in insert dict |
| `src/lib/validation/templates.ts` | `src/lib/types/validation.ts` | ProfileConfig type import | WIRED | Line 1: `import type { ProfileConfig, ValidationTemplate, EnabledChecks } from '@/lib/types/validation'` |
| `src/app/api/validate/route.ts` | FastAPI /api/v1/validate | fetch with config in body | WIRED | Line 67: `body: JSON.stringify({ dataset_id: datasetId, config: config ?? null })` |
| `src/components/files/file-detail-view.tsx` | `src/components/files/profile-selector.tsx` | selectedProfileId and onProfileChange props | WIRED | Line 476: `<ProfileSelector selectedProfileId={selectedProfileId} onProfileChange={handleProfileChange} .../>` — all props wired |
| `src/components/files/file-detail-view.tsx` | `/api/validate` | fetch with resolved config in body | WIRED | Lines 340-344: `body: JSON.stringify({ datasetId: dataset.id, config: currentConfig ?? undefined })` |
| `src/components/files/profile-selector.tsx` | `src/lib/validation/templates.ts` | DEFAULT_TEMPLATES import | WIRED | Line 19: `import { DEFAULT_TEMPLATES, getTemplateById } from "@/lib/validation/templates"` |
| `src/components/files/threshold-editor.tsx` | `src/lib/types/validation.ts` | ProfileConfig type for editing state | WIRED | Line 8: `import type { ProfileConfig } from "@/lib/types/validation"` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| VALE-06 | 06-01, 06-02, 06-03 | System provides default validation templates for DOB, DOC, and TOP survey types | SATISFIED | 4 default templates in Python (`backend/app/services/templates.py`) and TypeScript (`src/lib/validation/templates.ts`). ProfileSelector exposes them in a grouped dropdown. |
| VALE-08 | 06-01, 06-02, 06-03 | User can configure tolerance thresholds for QC checks (e.g., DOC/DOB limits) | SATISFIED | ThresholdEditor allows editing all range thresholds, z-score, IQR multiplier, KP settings. Config flows through to FastAPI. Profile save/edit/delete persists customizations. |

No orphaned requirements: REQUIREMENTS.md maps only VALE-06 and VALE-08 to Phase 6, both claimed by all 3 plans and both satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/validation/templates.ts` | 87-91 | general-survey thresholds differ from Python backend | Warning | Users customizing from "General Survey" start with different defaults than FastAPI would apply if config were omitted. Not a runtime error but a data contract inconsistency. |

No placeholder components, empty implementations, or TODO/FIXME comments found in phase-modified files.

---

### Human Verification Required

#### 1. End-to-End Validation Profile Flow

**Test:** Navigate to a file detail page with confirmed column mappings (DOB survey). Verify profile dropdown auto-selects "DOB Survey". Open dropdown and confirm 4 templates under "DEFAULTS". Click "Customize", edit DOB max to 3, then set DOB min to 10 (above max) and confirm error appears and Run QC disables. Fix the error, save as a named profile. Run QC and verify it completes.

**Expected:** Profile dropdown visible after mappings confirmed, auto-suggestion works, threshold editor inline, inline validation catches invalid configs, profile saves to MY PROFILES, Run QC executes with the selected config.

**Why human:** Plan 03 Task 3 is a blocking human-verify checkpoint. The SUMMARY records "Human verified end-to-end flow" in the self-check but no human approval artifact was left in the phase directory. The automated checks confirm all code wiring is correct, but the UX flow (dropdown rendering, expand/collapse animation, toast notifications, inline error display timing) requires a browser session to confirm.

---

### Gaps Summary

**One substantive gap, one human verification item:**

**Gap 1 — general-survey threshold parity (Warning-level):** The TypeScript `general-survey` template in `src/lib/validation/templates.ts` uses different threshold values than the Python `DEFAULT_TEMPLATES['general-survey']` in `backend/app/services/templates.py`. Specific divergences:

- `dob`: Python `{0, 10}` vs TypeScript `{-10, 20}`
- `doc`: Python `{0, 10}` vs TypeScript `{-10, 20}`
- `depth`: Python `{0, 500}` vs TypeScript `{0, 1000}`
- `easting`: Python `{100000, 900000}` vs TypeScript `{0, 1000000}`

This is a data contract inconsistency. When a user selects "General Survey" and does not customize, the UI shows TypeScript thresholds but FastAPI would apply General Survey defaults independently if the config were ever omitted. The fix is a one-line change per threshold in `src/lib/validation/templates.ts`.

**Human item — end-to-end flow sign-off:** Plan 03's Task 3 required human verification as a blocking gate. The SUMMARY self-check records the item as passed but the interaction happened during Plan 03 execution. Pending explicit human sign-off via the app.

---

*Verified: 2026-03-12T08:07:57Z*
*Verifier: Claude (gsd-verifier)*
