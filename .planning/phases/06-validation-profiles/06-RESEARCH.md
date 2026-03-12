# Phase 6: Validation Profiles - Research

**Researched:** 2026-03-12
**Domain:** Validation profile management, template-driven QC configuration, Supabase JSONB patterns
**Confidence:** HIGH

## Summary

Phase 6 transforms the hardcoded validation config in `validation.py` into a profile-driven system. The codebase is well-prepared for this: `run_validation_pipeline()` already accepts a `config` dict, `DEFAULT_THRESHOLDS` exists as a foundation, and JSONB storage is an established pattern (used for `column_mappings`). The work breaks down into: (1) database schema for profiles and config snapshots, (2) backend template definitions and config passthrough, (3) frontend profile selector with inline customization, and (4) CRUD operations for user-saved profiles.

The stack is entirely established -- Supabase for storage, shadcn/ui + base-ui for components, Next.js server actions for data mutations, and FastAPI for validation execution. No new libraries are needed. The primary complexity is in the UX: a grouped dropdown with section headers, an expandable threshold editing panel that shows only relevant fields, and inline validation of config values.

**Primary recommendation:** Build backend templates and DB schema first, then the profile selector UI, then threshold editing, then CRUD -- each layer builds on the previous.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 4 templates: DOB Survey, DOC Survey, TOP Survey, General Survey
- Each template is distinct -- different threshold ranges based on real survey norms for that data type
- Templates define both threshold values AND which validators are enabled (e.g., DOB template may skip duplicate KP check)
- General Survey is a catch-all with loose defaults that runs all checks
- Claude researches sensible industry default values during planning -- user will review
- Default templates are read-only -- users cannot modify or delete them
- Profile dropdown appears on the file detail page near the existing "Run QC" button
- System auto-suggests a profile based on detected column types from Phase 4 mappings
- User can always override the suggestion
- "Customize" button next to the dropdown opens an inline expansion panel (not a modal or separate page)
- The exact config snapshot (all thresholds + enabled checks) is stored with each validation run for audit traceability
- Inline customize panel expands below the profile dropdown
- Editable parameters: range min/max per column type, z-score threshold (default 3.0), IQR multiplier (default 1.5), KP-specific settings (max KP gap, duplicate KP tolerance, monotonicity check toggle)
- Only show thresholds relevant to the dataset's mapped columns (not all possible thresholds)
- Simple number inputs with unit labels (m), min and max side by side
- Inline validation: prevent nonsensical configs (min > max, negative z-scores, etc.)
- Run QC button disabled until config is valid
- "Reset" button to restore template defaults
- Tolerance per range check NOT exposed in MVP
- Users can save customized thresholds as named profiles ("Save as Profile")
- Profiles are per-user
- Full CRUD: create, view, edit, delete
- Profile management lives inside the dropdown panel
- Dropdown groups: "DEFAULTS" section and "MY PROFILES" section
- Editing a saved profile opens the same inline threshold panel, pre-filled

### Claude's Discretion
- Supabase table schema for validation_profiles
- How profile config is passed from frontend to FastAPI (extend ValidateRequest or separate endpoint)
- Auto-suggestion logic details (which column types map to which template)
- Exact UI component choices within shadcn/ui for the dropdown, panel, and inputs
- How to handle the transition from hardcoded config in validation.py to profile-driven config
- Profile name uniqueness constraints

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VALE-06 | System provides default validation templates for DOB, DOC, and TOP survey types | Template definitions with industry-standard thresholds; General Survey as 4th template; stored as seed data or code constants |
| VALE-08 | User can configure tolerance thresholds for QC checks (e.g., DOC/DOB limits) | Inline threshold editing panel; config JSONB schema; profile CRUD; config snapshot per validation run |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @base-ui/react | ^1.2.0 | Select, Collapsible primitives | Already used for Select component in project |
| shadcn/ui | ^4.0.2 | Pre-styled components (Input, Button, Label, Card, Badge, Select) | Project standard |
| Supabase | -- | Database + RLS for profile storage | Project standard |
| FastAPI + Pydantic | -- | Validation endpoint with typed request schemas | Project standard |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | -- | Toast notifications for save/delete/error feedback | Profile CRUD operations |
| lucide-react | -- | Icons (ChevronDown, Save, Trash2, RotateCcw, Settings2) | UI affordances |
| zod | -- | Client-side form validation for threshold inputs | Config validation before submit |

### No New Libraries Needed
This phase requires zero new dependencies. All UI components can be built from existing shadcn/ui primitives and base-ui.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/files/
│   ├── file-detail-view.tsx          # MODIFY: add profile state + pass to new components
│   ├── profile-selector.tsx          # NEW: dropdown with grouped defaults/custom profiles
│   ├── threshold-editor.tsx          # NEW: inline expandable config panel
│   └── ...
├── lib/
│   ├── types/
│   │   └── validation.ts            # MODIFY: add ProfileConfig, ValidationProfile types
│   ├── actions/
│   │   └── profiles.ts              # NEW: server actions for profile CRUD
│   └── validation/
│       └── templates.ts             # NEW: default template definitions (client-side constants)
├── app/api/
│   └── validate/route.ts            # MODIFY: pass config to FastAPI
backend/
├── app/
│   ├── models/schemas.py            # MODIFY: extend ValidateRequest with config
│   ├── routers/validation.py        # MODIFY: use config from request instead of hardcoded
│   └── services/
│       └── validation.py            # MODIFY: remove hardcoded config, receive from caller
│       └── templates.py             # NEW: template definitions (Python-side for validation)
supabase/
└── migrations/
    └── 00007_validation_profiles.sql # NEW: profiles table + config_snapshot column
```

### Pattern 1: Profile Config as JSONB
**What:** Store profile configuration as a typed JSONB column, same pattern as column_mappings
**When to use:** Flexible schema that may evolve without migrations

**Config shape (TypeScript):**
```typescript
interface ProfileConfig {
  // Range thresholds per column type
  ranges: Record<string, { min: number; max: number }>
  // e.g., { dob: { min: 0, max: 5 }, doc: { min: 0, max: 3 } }

  // Statistical thresholds
  zscore_threshold: number    // default 3.0
  iqr_multiplier: number      // default 1.5

  // KP-specific settings
  kp_gap_max: number | null   // null = auto (median*3)
  duplicate_kp_tolerance: number  // default 0.001
  monotonicity_check: boolean    // default true

  // Which validators are enabled
  enabled_checks: {
    range_check: boolean
    missing_data: boolean
    duplicate_rows: boolean
    near_duplicate_kp: boolean
    outliers_zscore: boolean
    outliers_iqr: boolean
    kp_gaps: boolean
    monotonicity: boolean
  }
}
```

**Python equivalent (Pydantic):**
```python
class RangeThreshold(BaseModel):
    min: float
    max: float

class EnabledChecks(BaseModel):
    range_check: bool = True
    missing_data: bool = True
    duplicate_rows: bool = True
    near_duplicate_kp: bool = True
    outliers_zscore: bool = True
    outliers_iqr: bool = True
    kp_gaps: bool = True
    monotonicity: bool = True

class ProfileConfig(BaseModel):
    ranges: dict[str, RangeThreshold] = {}
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    kp_gap_max: float | None = None
    duplicate_kp_tolerance: float = 0.001
    monotonicity_check: bool = True
    enabled_checks: EnabledChecks = EnabledChecks()
```

### Pattern 2: Config Passthrough from Frontend to FastAPI
**What:** Extend the validate API chain to pass config alongside dataset_id
**When to use:** Every validation request

The existing flow is: `FileDetailView` -> `POST /api/validate` -> `POST /api/v1/validate` (FastAPI). Extend each step:

```typescript
// Frontend: send config with validate request
body: JSON.stringify({ datasetId: dataset.id, config: resolvedConfig })

// API route: forward config to FastAPI
body: JSON.stringify({ dataset_id: datasetId, config: body.config })

// FastAPI ValidateRequest: accept optional config
class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None  # None = use General Survey defaults
```

### Pattern 3: Auto-Suggestion from Column Mappings
**What:** Map detected column types to a recommended profile
**When to use:** When file detail page loads with confirmed mappings

Logic (simple heuristic):
```typescript
function suggestProfile(mappings: ColumnMapping[]): string {
  const types = new Set(mappings
    .filter(m => !m.ignored && m.mappedType)
    .map(m => m.mappedType))

  if (types.has('dob')) return 'dob-survey'
  if (types.has('doc')) return 'doc-survey'
  if (types.has('top')) return 'top-survey'
  return 'general-survey'
}
```

Priority order matters: DOB > DOC > TOP > General. If a dataset has both DOB and DOC columns, DOB profile is suggested (user can override).

### Pattern 4: Config Snapshot per Validation Run
**What:** Store the exact config used for each run as JSONB on the validation_runs record
**When to use:** Every validation run, for audit traceability

Add `config_snapshot JSONB` column to `validation_runs` table. The FastAPI router stores the resolved config (after merging template defaults with any user overrides) when creating the run record.

### Anti-Patterns to Avoid
- **Storing templates in the database as seed data:** Default templates should be code constants (both frontend and backend), not seeded database rows. Simpler deployment, no migration issues, version-controlled. User profiles ARE in the database.
- **Separate page for profile management:** Context says inline -- the customize panel and profile CRUD all live within the file detail page dropdown/panel area.
- **Sending profile_id to FastAPI and having FastAPI look it up:** FastAPI should receive the fully resolved config dict. The Next.js API route resolves the profile (from template constants or Supabase) and sends the flat config. Keeps FastAPI stateless regarding profile storage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grouped dropdown with sections | Custom dropdown from scratch | shadcn/ui Select with SelectGroup + SelectGroupLabel | base-ui Select already supports groups natively |
| Collapsible panel | Custom show/hide with state | @base-ui/react Collapsible or simple conditional render with CSS transition | Accessible, animated expand/collapse |
| Form validation for thresholds | Manual if/else checks | Zod schema + inline error messages | Already available in project, handles edge cases (NaN, empty, min>max) |
| Config merging (template + overrides) | Deep merge utility | Structured spread with explicit defaults | Config is flat enough that a simple merge works |

## Common Pitfalls

### Pitfall 1: Forgetting to Filter Visible Thresholds by Mapped Columns
**What goes wrong:** All possible thresholds appear for every dataset, confusing users
**Why it happens:** The threshold panel renders ALL config fields regardless of what columns the dataset actually has
**How to avoid:** Read `column_mappings` from the dataset, extract the set of mapped types, and only render threshold inputs for those types. If dataset has no DOC column, hide DOC range inputs.
**Warning signs:** Users see DOC threshold fields when editing a DOB-only dataset

### Pitfall 2: Config Snapshot Missing on Re-runs
**What goes wrong:** User changes thresholds and re-runs, but the snapshot still shows old config
**Why it happens:** Config snapshot only stored on first run, not updated on re-runs
**How to avoid:** Always store config_snapshot with every new validation_runs record. Each run is a new row with its own snapshot.
**Warning signs:** Comparing runs shows identical configs despite user changes

### Pitfall 3: Hardcoded Config in validation.py Not Fully Replaced
**What goes wrong:** Some validators still use hardcoded defaults even when config is provided
**Why it happens:** The router's hardcoded `config = { ... }` is replaced but `DEFAULT_THRESHOLDS` in validation.py is still used as fallback
**How to avoid:** The config resolution should happen BEFORE calling `run_validation_pipeline()`. The config passed should be complete -- no silent fallbacks. Keep `DEFAULT_THRESHOLDS` only for building template definitions.
**Warning signs:** User sets DOB max to 5m but validation still flags at 10m

### Pitfall 4: Select Component String Value vs Object
**What goes wrong:** base-ui Select `onValueChange` returns string, but profile is an object
**Why it happens:** Project already encountered this (STATE.md: "Select onValueChange returns string|null")
**How to avoid:** Use profile slug/id as the Select value, then look up the full profile object from the slug. For default templates, use a constant map. For user profiles, fetch from state.
**Warning signs:** Type errors when trying to use the selected value as a profile object

### Pitfall 5: Race Condition Between Profile Save and Validation Run
**What goes wrong:** User clicks "Save as Profile" then immediately "Run QC" -- profile might not be saved yet
**Why it happens:** Async save hasn't completed when validation starts
**How to avoid:** Disable Run QC button while saving. Or better: the config is already in local state -- send the resolved config object, not the profile_id.
**Warning signs:** Validation runs with stale or missing config

## Code Examples

### Default Template Definitions (TypeScript)
```typescript
// src/lib/validation/templates.ts
export interface ProfileConfig {
  ranges: Record<string, { min: number; max: number }>
  zscore_threshold: number
  iqr_multiplier: number
  kp_gap_max: number | null
  duplicate_kp_tolerance: number
  monotonicity_check: boolean
  enabled_checks: {
    range_check: boolean
    missing_data: boolean
    duplicate_rows: boolean
    near_duplicate_kp: boolean
    outliers_zscore: boolean
    outliers_iqr: boolean
    kp_gaps: boolean
    monotonicity: boolean
  }
}

export interface ValidationTemplate {
  id: string
  name: string
  survey_type: string
  description: string
  config: ProfileConfig
  is_default: true
}

export const DEFAULT_TEMPLATES: ValidationTemplate[] = [
  {
    id: 'dob-survey',
    name: 'DOB Survey',
    survey_type: 'DOB',
    description: 'Depth of burial survey with typical pipeline burial thresholds',
    is_default: true,
    config: {
      ranges: {
        dob: { min: 0, max: 5 },      // DOB typically 0-5m
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
      zscore_threshold: 3.0,
      iqr_multiplier: 1.5,
      kp_gap_max: null,  // auto
      duplicate_kp_tolerance: 0.001,
      monotonicity_check: true,
      enabled_checks: {
        range_check: true,
        missing_data: true,
        duplicate_rows: true,
        near_duplicate_kp: true,
        outliers_zscore: true,
        outliers_iqr: true,
        kp_gaps: true,
        monotonicity: true,
      },
    },
  },
  {
    id: 'doc-survey',
    name: 'DOC Survey',
    survey_type: 'DOC',
    description: 'Depth of cover survey with seabed-to-pipe-top thresholds',
    is_default: true,
    config: {
      ranges: {
        doc: { min: 0, max: 3 },       // DOC typically 0-3m
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
      zscore_threshold: 3.0,
      iqr_multiplier: 1.5,
      kp_gap_max: null,
      duplicate_kp_tolerance: 0.001,
      monotonicity_check: true,
      enabled_checks: {
        range_check: true,
        missing_data: true,
        duplicate_rows: true,
        near_duplicate_kp: true,
        outliers_zscore: true,
        outliers_iqr: true,
        kp_gaps: true,
        monotonicity: true,
      },
    },
  },
  {
    id: 'top-survey',
    name: 'TOP Survey',
    survey_type: 'TOP',
    description: 'Top of pipe survey with elevation/depth thresholds',
    is_default: true,
    config: {
      ranges: {
        top: { min: -200, max: 200 },   // TOP can be negative (below seabed)
        depth: { min: 0, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
      },
      zscore_threshold: 3.0,
      iqr_multiplier: 1.5,
      kp_gap_max: null,
      duplicate_kp_tolerance: 0.001,
      monotonicity_check: true,
      enabled_checks: {
        range_check: true,
        missing_data: true,
        duplicate_rows: true,
        near_duplicate_kp: true,
        outliers_zscore: true,
        outliers_iqr: true,
        kp_gaps: true,
        monotonicity: true,
      },
    },
  },
  {
    id: 'general-survey',
    name: 'General Survey',
    survey_type: 'General',
    description: 'Catch-all template with generous thresholds; runs all checks',
    is_default: true,
    config: {
      ranges: {
        dob: { min: 0, max: 10 },
        doc: { min: 0, max: 10 },
        top: { min: -500, max: 500 },
        depth: { min: 0, max: 500 },
        elevation: { min: -500, max: 500 },
        easting: { min: 100000, max: 900000 },
        northing: { min: 0, max: 10000000 },
        latitude: { min: -90, max: 90 },
        longitude: { min: -180, max: 180 },
      },
      zscore_threshold: 3.0,
      iqr_multiplier: 1.5,
      kp_gap_max: null,
      duplicate_kp_tolerance: 0.001,
      monotonicity_check: true,
      enabled_checks: {
        range_check: true,
        missing_data: true,
        duplicate_rows: true,
        near_duplicate_kp: true,
        outliers_zscore: true,
        outliers_iqr: true,
        kp_gaps: true,
        monotonicity: true,
      },
    },
  },
]
```

### Supabase Migration for Profiles
```sql
-- 00007_validation_profiles.sql

-- User-saved validation profiles
CREATE TABLE public.validation_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  survey_type TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_profiles_user_id ON public.validation_profiles(user_id);

-- Unique profile names per user
CREATE UNIQUE INDEX idx_validation_profiles_user_name
  ON public.validation_profiles(user_id, name);

ALTER TABLE public.validation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles"
  ON public.validation_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles"
  ON public.validation_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
  ON public.validation_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON public.validation_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER on_validation_profile_updated
  BEFORE UPDATE ON public.validation_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add config_snapshot to validation_runs
ALTER TABLE public.validation_runs
  ADD COLUMN config_snapshot JSONB;

-- Add profile_id reference (nullable -- runs can use inline config without saving)
ALTER TABLE public.validation_runs
  ADD COLUMN profile_id UUID REFERENCES public.validation_profiles(id) ON DELETE SET NULL;
```

### Extended ValidateRequest (Python)
```python
class RangeThreshold(BaseModel):
    min: float
    max: float

class EnabledChecks(BaseModel):
    range_check: bool = True
    missing_data: bool = True
    duplicate_rows: bool = True
    near_duplicate_kp: bool = True
    outliers_zscore: bool = True
    outliers_iqr: bool = True
    kp_gaps: bool = True
    monotonicity: bool = True

class ProfileConfig(BaseModel):
    ranges: dict[str, RangeThreshold] = {}
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    kp_gap_max: float | None = None
    duplicate_kp_tolerance: float = 0.001
    monotonicity_check: bool = True
    enabled_checks: EnabledChecks = EnabledChecks()

class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None
```

### Config Resolution in validation.py Router
```python
# In routers/validation.py, replace hardcoded config:
profile_config = request.config or ProfileConfig()  # General defaults via Pydantic

# Convert ProfileConfig to flat config dict for run_validation_pipeline
config = {}
for col_type, threshold in profile_config.ranges.items():
    config[f"{col_type}_min"] = threshold.min
    config[f"{col_type}_max"] = threshold.max
config["zscore_threshold"] = profile_config.zscore_threshold
config["iqr_multiplier"] = profile_config.iqr_multiplier
if profile_config.kp_gap_max is not None:
    config["kp_gap_max"] = profile_config.kp_gap_max
config["duplicate_kp_tolerance"] = profile_config.duplicate_kp_tolerance

# Store snapshot
supabase.table("validation_runs").insert({
    "id": run_id,
    "dataset_id": request.dataset_id,
    "config_snapshot": profile_config.model_dump(),
    ...
}).execute()
```

### Modifying run_validation_pipeline for Enabled Checks
```python
# In services/validation.py, add enabled_checks filtering:
def run_validation_pipeline(
    df: pd.DataFrame,
    column_mappings: list[dict],
    config: dict,
    enabled_checks: dict | None = None,
) -> list[ValidationIssue]:
    checks = enabled_checks or {}
    all_issues: list[ValidationIssue] = []
    kp_column = _find_kp_column(column_mappings)

    for mapping in _get_mapped_columns(column_mappings):
        col_type = mapping.get("mappedType")
        col_name = mapping.get("originalName", col_type)
        if col_type not in NUMERIC_COLUMN_TYPES or col_name not in df.columns:
            continue

        if checks.get("range_check", True):
            # range check logic...
            pass

        if checks.get("missing_data", True):
            all_issues.extend(check_missing_data(df, col_name, kp_column=kp_column))

        if checks.get("outliers_zscore", True):
            # zscore check...
            pass

        if checks.get("outliers_iqr", True):
            # iqr check...
            pass

    if kp_column and kp_column in df.columns:
        if checks.get("kp_gaps", True):
            all_issues.extend(check_kp_gaps(df, kp_column, max_gap=config.get("kp_gap_max")))
        if checks.get("monotonicity", True):
            all_issues.extend(check_monotonicity(df, kp_column))
        if checks.get("near_duplicate_kp", True):
            all_issues.extend(check_near_duplicate_kp(df, kp_column, tolerance=config.get("duplicate_kp_tolerance", 0.001)))

    if checks.get("duplicate_rows", True):
        all_issues.extend(check_duplicate_rows(df, kp_column=kp_column))

    return all_issues
```

## Industry Default Threshold Research

Based on pipeline survey industry norms (confidence: MEDIUM -- based on domain knowledge, should be reviewed by user):

| Column Type | Template | Min | Max | Rationale |
|------------|----------|-----|-----|-----------|
| DOB | DOB Survey | 0 m | 5 m | Typical burial depths rarely exceed 3-5m; >5m likely error |
| DOB | General | 0 m | 10 m | Generous catch-all |
| DOC | DOC Survey | 0 m | 3 m | Cover depth typically 0.6-2m; >3m unusual |
| DOC | General | 0 m | 10 m | Generous catch-all |
| TOP | TOP Survey | -200 m | 200 m | TOP is relative to seabed, can be negative |
| TOP | General | -500 m | 500 m | Generous catch-all |
| depth | All | 0 m | 500 m | Water depth; most pipeline work <300m |
| elevation | General | -500 m | 500 m | Seabed elevation relative to chart datum |

Statistical defaults (all templates):
- Z-score threshold: 3.0 (standard 3-sigma rule)
- IQR multiplier: 1.5 (standard Tukey fence)
- KP gap max: null (auto-detect via median*3 -- already implemented)
- Duplicate KP tolerance: 0.001 km (1 meter)

## State of the Art

| Old Approach (Phase 5) | New Approach (Phase 6) | Impact |
|------------------------|----------------------|--------|
| Hardcoded config dict in router | Profile-driven config from frontend | Users control thresholds |
| Single set of defaults | 4 survey-type templates | Better defaults per survey type |
| No config history | Config snapshot per run | Audit traceability |
| No user customization | Full CRUD on custom profiles | Reusable configs |

## Open Questions

1. **Coordinate range thresholds: useful or noise?**
   - What we know: Easting/northing/lat/lon ranges vary wildly by project location
   - What's unclear: Whether range checks on coordinates are useful in practice
   - Recommendation: Include in General template with very generous ranges; DOB/DOC/TOP templates can include them but they mainly serve as sanity checks. Users can disable if noisy.

2. **What happens when a user deletes a profile that was used in a past run?**
   - What we know: `config_snapshot` stores the full config on the run record, so historical data is preserved
   - What's unclear: Should the `profile_id` on validation_runs use SET NULL on delete?
   - Recommendation: Yes, ON DELETE SET NULL -- the snapshot is the source of truth, the profile_id is just a convenience reference

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) |
| Config file | backend/tests/conftest.py |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALE-06 | Default templates produce correct config dicts | unit | `cd backend && python -m pytest tests/test_templates.py -x` | No -- Wave 0 |
| VALE-06 | Each template enables/disables correct validators | unit | `cd backend && python -m pytest tests/test_templates.py::test_template_enabled_checks -x` | No -- Wave 0 |
| VALE-08 | ProfileConfig Pydantic model validates input correctly | unit | `cd backend && python -m pytest tests/test_schemas.py -x` | No -- Wave 0 |
| VALE-08 | run_validation_pipeline respects enabled_checks toggles | unit | `cd backend && python -m pytest tests/validators/test_enabled_checks.py -x` | No -- Wave 0 |
| VALE-08 | Config snapshot stored on validation_runs record | integration | Manual -- requires Supabase | manual-only |
| VALE-08 | Invalid config rejected (min > max, negative z-score) | unit | `cd backend && python -m pytest tests/test_schemas.py::test_invalid_config -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_templates.py` -- covers VALE-06 template definitions and config generation
- [ ] `backend/tests/test_schemas.py` -- covers VALE-08 ProfileConfig validation
- [ ] `backend/tests/validators/test_enabled_checks.py` -- covers VALE-08 enabled_checks filtering

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/services/validation.py`, `backend/app/routers/validation.py`, `backend/app/models/schemas.py` -- current validation implementation
- Existing codebase: `src/components/files/file-detail-view.tsx` -- current file detail page with Run QC button
- Existing codebase: `src/lib/parsing/column-detector.ts` -- SurveyColumnType enum and EXPECTED_COLUMNS mapping
- Existing codebase: `supabase/migrations/00006_validation_tables.sql` -- current validation_runs schema
- CONTEXT.md: All user decisions and constraints

### Secondary (MEDIUM confidence)
- Industry threshold defaults based on general pipeline survey engineering knowledge -- user should review specific values
- base-ui Select grouped dropdown pattern -- inferred from existing Select component usage in project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new deps
- Architecture: HIGH -- extends established patterns (JSONB config, server actions, FastAPI proxy)
- Pitfalls: HIGH -- based on actual codebase analysis and known project patterns (base-ui quirks, etc.)
- Industry thresholds: MEDIUM -- reasonable defaults but user review recommended

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain, no fast-moving dependencies)
