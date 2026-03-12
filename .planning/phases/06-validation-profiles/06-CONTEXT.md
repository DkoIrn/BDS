# Phase 6: Validation Profiles - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can select survey-type templates and configure tolerance thresholds for their QC checks. This phase delivers: 4 default validation templates (DOB, DOC, TOP, General Survey), a profile selection dropdown on the file detail page with auto-suggestion, an inline threshold customization panel, user-saved custom profiles with full CRUD, and config snapshot storage per validation run. Custom rule creation (VALE-09), profile sharing (VALE-10), and cross-dataset checks (VALE-11) are v2 scope.

</domain>

<decisions>
## Implementation Decisions

### Default Templates
- 4 templates: DOB Survey, DOC Survey, TOP Survey, General Survey
- Each template is distinct — different threshold ranges based on real survey norms for that data type
- Templates define both threshold values AND which validators are enabled (e.g., DOB template may skip duplicate KP check)
- General Survey is a catch-all with loose defaults that runs all checks
- Claude researches sensible industry default values during planning — user will review
- Default templates are read-only — users cannot modify or delete them

### Profile Selection UX
- Profile dropdown appears on the file detail page near the existing "Run QC" button
- System auto-suggests a profile based on detected column types from Phase 4 mappings (e.g., DOB columns → pre-select DOB Survey profile)
- User can always override the suggestion
- "Customize" button next to the dropdown opens an inline expansion panel (not a modal or separate page)
- The exact config snapshot (all thresholds + enabled checks) is stored with each validation run for audit traceability

### Threshold Editing
- Inline customize panel expands below the profile dropdown
- Editable parameters:
  - Range min/max per column type (DOB, DOC, depth, TOP, etc.)
  - Statistical thresholds: z-score threshold (default 3.0), IQR multiplier (default 1.5)
  - KP-specific settings: max KP gap, duplicate KP tolerance, monotonicity check toggle
- Only show thresholds relevant to the dataset's mapped columns (not all possible thresholds)
- Simple number inputs with unit labels (m), min and max side by side
- Inline validation: prevent nonsensical configs (min > max, negative z-scores, etc.) with error messages
- Run QC button disabled until config is valid
- "Reset" button to restore template defaults
- Tolerance per range check NOT exposed in MVP (keep it simpler)

### Custom Profile Persistence
- Users can save customized thresholds as named profiles ("Save as Profile" with user-provided name)
- Profiles are per-user — each user has their own saved profiles
- Full CRUD: create, view, edit, delete
- Profile management lives inside the dropdown panel — custom profiles show edit/delete icons
- Dropdown groups: "DEFAULTS" section (4 system templates) and "MY PROFILES" section (user-saved)
- Editing a saved profile opens the same inline threshold panel, pre-filled with that profile's values
- Save button updates the existing profile

### Claude's Discretion
- Supabase table schema for validation_profiles
- How profile config is passed from frontend to FastAPI (extend ValidateRequest or separate endpoint)
- Auto-suggestion logic details (which column types map to which template)
- Exact UI component choices within shadcn/ui for the dropdown, panel, and inputs
- How to handle the transition from hardcoded config in validation.py to profile-driven config
- Profile name uniqueness constraints

</decisions>

<specifics>
## Specific Ideas

- The customize panel mockup was confirmed: collapsible sections for Range Thresholds, Statistical Checks, and Enabled Checks
- Dropdown should visually separate system defaults from user profiles (section headers: "DEFAULTS" / "MY PROFILES")
- Auto-suggestion leverages the column detection work from Phase 4 — reduces friction for users who upload and go
- Config snapshot per validation run supports the comparison workflow mentioned in Phase 5 context ("comparing results across re-runs after threshold adjustments")

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `run_validation_pipeline()` (backend/app/services/validation.py) — already parameterized with a `config` dict containing all thresholds; just needs real config instead of hardcoded values
- `DEFAULT_THRESHOLDS` dict in validation.py — can be expanded into full template definitions
- `ValidateRequest` (backend/app/models/schemas.py) — needs extension to accept profile/config
- Column detector `SurveyColumnType` enum (src/lib/parsing/column-detector.ts) — basis for auto-suggestion logic
- File detail page — has "Run QC" button where profile dropdown integrates
- Badge component, sonner toasts — for validation feedback and status indicators

### Established Patterns
- Server Components for data fetching, Client Components for interactivity
- Supabase server client with getUser() for auth checks
- API routes at src/app/api/ proxying to FastAPI
- Client orchestrator pattern on file detail page (FileDetailView)
- JSONB storage for flexible schema (used for column_mappings — same pattern for profile config)

### Integration Points
- File detail page: add profile dropdown + customize panel above/near Run QC button
- validation.py router: replace hardcoded config dict with profile-driven config
- ValidateRequest schema: accept config/profile_id
- validation_runs table: add config_snapshot JSONB column
- New table: validation_profiles (id, user_id, name, survey_type, config JSONB, is_default, created_at, updated_at)
- New API route or server actions for profile CRUD
- Column mappings on dataset record: used to determine auto-suggested profile and visible thresholds

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-validation-profiles*
*Context gathered: 2026-03-12*
