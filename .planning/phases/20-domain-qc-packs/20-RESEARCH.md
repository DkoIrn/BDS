# Phase 20: Domain-Specific QC Packs - Research

**Researched:** 2026-04-09
**Domain:** Validation engine extension, domain pack definitions, chain-aware validators, UI enhancement
**Confidence:** HIGH

## Summary

Phase 20 replaces the 4 generic column-type-focused templates (DOB/DOC/TOP/General) with 3 workflow-specific domain packs (Pipeline As-Laid QC, As-Built Survey QC, Pre-Commissioning QC) plus a General catch-all. It adds 2 new chain-aware validators (KP drift, segment continuity) to the backend, extends ProfileConfig/EnabledChecks schemas on both frontend and backend, and enhances the profile selector UI with richer metadata and auto-suggestion.

The existing codebase has clean, well-established patterns for all touchpoints. Validators are pure functions taking `(df, column_mappings, config)` and returning `list[ValidationIssue]`. Templates are defined identically in `templates.ts` (frontend) and `templates.py` (backend) and must stay in sync. The validation pipeline in `validation.py` orchestrates all checks gated by `enabled_checks` dict. The profile selector and threshold editor are modular components that accept config via props.

**Primary recommendation:** Execute as 2 plans -- (1) backend: new validators + schema extensions + pack definitions in Python, (2) frontend: matching schema extensions + pack definitions in TS + UI enhancements (selector, editor, suggestion banner).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 domain packs + General: Pipeline As-Laid, As-Built Survey, Pre-Commissioning, General
- Replace existing 4 templates (DOB/DOC/TOP/General) with the new packs
- Each pack has: name, 1-2 line description, list of expected column types
- Packs are read-only system defaults. Users can customize thresholds and "Save as Profile"
- Pipeline As-Laid: Tight KP + depth focus. KP gap max 0.01km, duplicate KP tolerance 0.0005km, DOB range 0-3m, depth 0-300m, monotonicity always enforced, all coordinate/position checks enabled
- As-Built Survey: DOC + cross-column focus. DOC range 0-2m, DOB range 0-5m, cross-column consistency critical, coordinate sanity strict, spike detection more aggressive
- Pre-Commissioning: Event listing + position focus. Event_listing checks critical, position_consistency strict, looser depth/DOB tolerances, KP monotonicity enforced, coordinate jumps flagged aggressively
- Add `tolerance` field to RangeThreshold: {min, max, tolerance}
- 2 new validators: Cumulative KP drift + Segment continuity
- Both enabled in all 3 packs with varying severity
- New ProfileConfig fields: `kp_drift_tolerance`, `max_segment_distance`
- New EnabledChecks booleans: `kp_drift`, `segment_continuity` (15 total, up from 13)
- Extend profile selector dropdown with pack descriptions + column pills
- New "Chain Checks" group in threshold editor
- Auto-suggestion banner in pipeline Validate stage

### Claude's Discretion
- Exact threshold values for z-score/IQR per pack (slight tuning from General defaults)
- Pack description text and expected column lists
- Auto-suggestion matching algorithm (column type overlap threshold)
- Threshold editor slider ranges and step sizes for new chain check fields
- How to handle packs when required columns are not mapped (warning vs block)

### Deferred Ideas (OUT OF SCOPE)
- Auto-suggest based on file naming conventions
- Custom rule builder (drag-and-drop check configuration)
- Context-aware QC (shallow vs deep water thresholds)
- Multi-file cross-dataset validation
- ROV Inspection and Seabed/Bathymetry Survey packs
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| pandas | existing | DataFrame operations in validators | Used by all validators |
| pydantic | existing | Schema validation (ProfileConfig, RangeThreshold, EnabledChecks) | Backend models |
| Next.js | existing | Frontend framework | App Router with server/client components |
| shadcn/ui | existing | UI components (Select, Input, Button, Card) | Used in profile-selector, threshold-editor |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| math (stdlib) | Distance calculations in chain validators | KP drift + segment continuity |
| numpy | Vectorized operations for large datasets | Already a pandas dependency |

No new libraries needed. All functionality builds on existing stack.

## Architecture Patterns

### Validator Pattern (Established)
All validators follow this exact signature:
```python
# Pure function, no class state
def check_something(
    df: pd.DataFrame,
    column_mappings: list[dict],  # or specific params
    kp_column: str | None = None,
    # Additional config params...
) -> list[ValidationIssue]:
```

New validators MUST follow this pattern. The `ValidationIssue` dataclass from `base.py` is the standard return type.

### Template Sync Pattern (Established)
Templates are defined identically in two files that MUST stay in sync:
- `src/lib/validation/templates.ts` -- frontend (TypeScript)
- `backend/app/services/templates.py` -- backend (Python)

The frontend templates include full `ProfileConfig` objects with `as const satisfies` for type safety. The backend uses Pydantic model instances in `DEFAULT_TEMPLATES` dict keyed by slug.

### Config Resolution Pattern (Established)
```python
# templates.py
def resolve_config(config: ProfileConfig) -> tuple[dict, dict]:
    # Returns (flat_config_dict, enabled_checks_dict)
    # flat_config has keys like "dob_min", "dob_max", "zscore_threshold"
    # enabled_checks has keys like "range_check", "missing_data"
```

New config fields (`kp_drift_tolerance`, `max_segment_distance`) must be added to `resolve_config()` output.

### Pipeline Orchestration Pattern (Established)
```python
# validation.py - run_validation_pipeline()
if checks.get("kp_drift", True):
    all_issues.extend(check_kp_drift(df, ...))
```

Each new check is gated by its `enabled_checks` key with `True` default for backward compatibility.

### Profile Selector Pattern (Established)
- `DEFAULT_TEMPLATES` array renders in SelectGroup with "DEFAULTS" label
- User profiles render in separate SelectGroup with "MY PROFILES" label
- SelectItem shows template name; ThresholdEditor opens on "Customize" click

### Project Structure for New Files
```
backend/app/validators/
  kp_drift.py          # NEW: Cumulative KP drift validator
  segment_continuity.py # NEW: Segment continuity validator

backend/tests/validators/
  test_kp_drift.py     # NEW: Tests for KP drift
  test_segment_continuity.py # NEW: Tests for segment continuity
```

Modified files:
```
backend/app/models/schemas.py         # Extend RangeThreshold, EnabledChecks, ProfileConfig
backend/app/services/templates.py     # Replace 4 templates with 4 new packs
backend/app/services/validation.py    # Wire new validators into pipeline

src/lib/types/validation.ts           # Mirror schema extensions
src/lib/validation/templates.ts       # Replace 4 templates with 4 new packs
src/components/files/profile-selector.tsx  # Richer dropdown items
src/components/files/threshold-editor.tsx  # Chain Checks group
src/app/(dashboard)/pipeline/components/stage-validate.tsx  # Suggestion banner
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance between coordinates | Manual haversine | math.hypot for projected, existing `_check_coordinate_jumps` pattern for geographic | spatial.py already has the pattern |
| KP-distance comparison | New abstraction layer | Direct pandas vectorized operations | Simple math, no framework needed |
| Pack matching algorithm | Complex ML/scoring | Simple set overlap: count matched column types / expected column types | Deterministic, explainable |

## Common Pitfalls

### Pitfall 1: Frontend/Backend Template Desync
**What goes wrong:** Pack definitions differ between TS and Python causing validation to use wrong thresholds.
**Why it happens:** Two separate files defining the same data.
**How to avoid:** Change both files in the same plan/task. Use identical IDs, names, and config values. Test by selecting each pack and verifying config matches.
**Warning signs:** Different issue counts when running same data through pipeline vs. client validation.

### Pitfall 2: RangeThreshold Tolerance Backward Compatibility
**What goes wrong:** Adding required `tolerance` field breaks existing user-saved profiles that don't have it.
**Why it happens:** Pydantic model change affects deserialization of existing JSONB data.
**How to avoid:** Make `tolerance` field Optional with default `None` or `0.0`. Use `tolerance: float = 0.0` in Pydantic model, `tolerance?: number` in TypeScript interface.
**Warning signs:** 500 errors when loading saved user profiles after deployment.

### Pitfall 3: EnabledChecks Default Values
**What goes wrong:** New `kp_drift` and `segment_continuity` booleans default to True, causing existing saved profiles to unexpectedly run new checks.
**Why it happens:** Pydantic default True + existing JSONB without these keys = auto-enabled.
**How to avoid:** This is actually the desired behavior (backward compatible = all checks enabled). But document this in the pack descriptions so users know new checks are active. The existing pattern (all defaults True) is correct.

### Pitfall 4: KP Drift Division by Zero
**What goes wrong:** KP drift calculation divides by computed distance, which can be zero for identical consecutive coordinates.
**Why it happens:** Duplicate rows or stationary points.
**How to avoid:** Guard against zero distance: skip comparison when computed distance < epsilon (e.g., 0.001m). Existing `MIN_KP_STEP` pattern in position.py shows how.

### Pitfall 5: Auto-Suggestion Overreach
**What goes wrong:** Suggestion banner appears on every dataset, annoying users.
**Why it happens:** Too-loose matching threshold.
**How to avoid:** Require at least 60-70% of a pack's expected columns to be mapped before suggesting. Only suggest the single best match, not multiple. Make dismissible and don't re-show after dismissal.

## Code Examples

### New Validator: KP Drift (Backend Pattern)
```python
# backend/app/validators/kp_drift.py
# Follows established pure-function validator pattern from spatial.py

import pandas as pd
from app.validators.base import ValidationIssue, Severity

def check_kp_drift(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
    kp_drift_tolerance: float = 0.01,  # 1% default
) -> list[ValidationIssue]:
    """Detect cumulative KP drift vs actual coordinate distances.
    
    Drift = |KP_increment - computed_distance| / computed_distance
    Flags when drift exceeds tolerance (e.g., 1% for As-Laid).
    """
    issues: list[ValidationIssue] = []
    if not kp_column or kp_column not in df.columns:
        return issues
    
    # Find coordinate columns (reuse pattern from position.py)
    x_col, y_col, coord_type = _find_coord_columns(column_mappings)
    if not x_col or not y_col:
        return issues
    
    # Vectorized computation...
    # For each consecutive pair: compare KP increment to coordinate distance
    # Flag when drift > tolerance
    
    return issues
```

### Extended RangeThreshold (Backend)
```python
# schemas.py
class RangeThreshold(BaseModel):
    min: float
    max: float
    tolerance: float = 0.0  # Optional, backward compatible

    @model_validator(mode="after")
    def min_must_not_exceed_max(self):
        if self.min > self.max:
            raise ValueError(f"min ({self.min}) must not be greater than max ({self.max})")
        return self
```

### Extended ProfileConfig (Backend)
```python
class ProfileConfig(BaseModel):
    ranges: dict[str, RangeThreshold] = {}
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    kp_gap_max: float | None = None
    duplicate_kp_tolerance: float = 0.001
    monotonicity_check: bool = True
    enabled_checks: EnabledChecks = EnabledChecks()
    # New chain check fields
    kp_drift_tolerance: float = 0.01       # 1% default
    max_segment_distance: float = 100.0    # 100m default
```

### Extended TypeScript Types
```typescript
// validation.ts
export interface EnabledChecks {
  // ... existing 13 checks ...
  kp_drift: boolean
  segment_continuity: boolean
}

export interface ProfileConfig {
  // ... existing fields ...
  kp_drift_tolerance: number
  max_segment_distance: number
}

// Range now includes optional tolerance
export interface RangeThreshold {
  min: number
  max: number
  tolerance?: number
}
```

### Pack Definition Example (Frontend)
```typescript
// templates.ts
{
  id: 'pipeline-as-laid',
  name: 'Pipeline As-Laid QC',
  survey_type: 'as-laid',
  description: 'Tight KP and depth validation for as-laid pipeline surveys',
  expectedColumns: ['kp', 'dob', 'depth', 'easting', 'northing'],
  config: {
    ...COMMON_CONFIG,
    kp_gap_max: 0.01,
    duplicate_kp_tolerance: 0.0005,
    kp_drift_tolerance: 0.01,      // 1%
    max_segment_distance: 50,       // 50m
    ranges: {
      dob: { min: 0, max: 3, tolerance: 0.1 },
      depth: { min: 0, max: 300 },
      easting: { min: 100000, max: 900000 },
      northing: { min: 0, max: 10000000 },
    },
    enabled_checks: {
      ...DEFAULT_ENABLED_CHECKS,
      kp_drift: true,
      segment_continuity: true,
    },
  },
  is_default: true,
}
```

### Auto-Suggestion Algorithm
```typescript
// templates.ts
export function suggestProfile(mappings: ColumnMapping[]): string | null {
  const mappedTypes = new Set(
    mappings
      .filter((m) => !m.ignored && m.mappedType !== null)
      .map((m) => m.mappedType)
  )
  
  // Score each pack by column overlap
  const packs = DEFAULT_TEMPLATES.filter(t => t.id !== 'general-survey')
  let bestMatch: { id: string; score: number } | null = null
  
  for (const pack of packs) {
    const expected = pack.expectedColumns ?? []
    if (expected.length === 0) continue
    const matched = expected.filter(col => mappedTypes.has(col)).length
    const score = matched / expected.length
    if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: pack.id, score }
    }
  }
  
  return bestMatch?.id ?? 'general-survey'
}
```

### Suggestion Banner in Pipeline (stage-validate.tsx)
```tsx
// Dismissible banner at top of validate stage
{suggestedPack && !dismissed && (
  <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
    <Info className="size-4 text-teal-600" />
    <span className="flex-1 text-sm">
      This looks like an <strong>{suggestedPack.name}</strong> dataset. Use recommended QC settings?
    </span>
    <Button size="sm" onClick={handleApplyPack}>Apply</Button>
    <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
      <X className="size-4" />
    </Button>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 4 column-type templates (DOB/DOC/TOP/General) | 3 workflow-specific packs + General | Smarter defaults aligned to actual survey workflows |
| No chain-aware validation | KP drift + segment continuity checks | Catches compounding errors that individual row checks miss |
| Binary range check (in/out) | Range with tolerance field | Soft boundaries reduce false positives near limits |
| Simple column-presence suggestion | Column overlap scoring with threshold | More accurate pack suggestion for mixed datasets |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (via pyproject.toml) |
| Config file | backend/pyproject.toml [tool.pytest.ini_options] |
| Quick run command | `cd backend && python -m pytest tests/validators/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACK-01 | KP drift validator detects drift above tolerance | unit | `cd backend && python -m pytest tests/validators/test_kp_drift.py -x` | Wave 0 |
| PACK-02 | Segment continuity flags impossible distances | unit | `cd backend && python -m pytest tests/validators/test_segment_continuity.py -x` | Wave 0 |
| PACK-03 | RangeThreshold tolerance field backward compatible | unit | `cd backend && python -m pytest tests/validators/test_range_check.py -x` | Exists (extend) |
| PACK-04 | EnabledChecks gates new validators | unit | `cd backend && python -m pytest tests/validators/test_enabled_checks.py -x` | Exists (extend) |
| PACK-05 | Pack definitions match between frontend/backend | manual | Visual diff of templates.ts vs templates.py | N/A |
| PACK-06 | Auto-suggestion selects correct pack | unit | Frontend test or manual verification | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/validators/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/validators/test_kp_drift.py` -- covers KP drift detection
- [ ] `backend/tests/validators/test_segment_continuity.py` -- covers segment continuity
- [ ] Extend `test_enabled_checks.py` with kp_drift and segment_continuity gating
- [ ] Extend `test_range_check.py` with tolerance field behavior

## Open Questions

1. **RangeThreshold tolerance in range_check validator**
   - What we know: The `check_range` function already accepts a `tolerance` param (line 86 of validation.py: `config.get(f"{col_type}_tolerance", 0.0)`)
   - What's unclear: Whether this existing tolerance parameter aligns with the new `RangeThreshold.tolerance` field or needs mapping in `resolve_config()`
   - Recommendation: Map `RangeThreshold.tolerance` to `{col_type}_tolerance` in `resolve_config()` flat dict to maintain existing flow

2. **Severity variation per pack for chain checks**
   - What we know: CONTEXT.md specifies As-Laid KP drift = CRITICAL, As-Built = WARNING, etc.
   - What's unclear: Validators currently determine severity internally, not from config
   - Recommendation: Add optional `kp_drift_severity` and `segment_continuity_severity` fields to ProfileConfig (or pass via config dict), letting the validator use it. Default to WARNING for backward compatibility.

## Sources

### Primary (HIGH confidence)
- `backend/app/validators/base.py` -- Validator Protocol and ValidationIssue dataclass
- `backend/app/services/validation.py` -- run_validation_pipeline orchestration pattern
- `backend/app/services/templates.py` -- Backend template definitions and resolve_config
- `backend/app/models/schemas.py` -- Pydantic schemas (ProfileConfig, EnabledChecks, RangeThreshold)
- `src/lib/validation/templates.ts` -- Frontend template definitions
- `src/lib/types/validation.ts` -- Frontend type definitions
- `src/components/files/profile-selector.tsx` -- Profile selector UI component
- `src/components/files/threshold-editor.tsx` -- Threshold editor UI component
- `backend/app/validators/spatial.py` -- Reference pattern for coordinate-based validators
- `backend/app/validators/position.py` -- Reference pattern for KP-distance calculations

### Secondary (MEDIUM confidence)
- `backend/tests/validators/test_enabled_checks.py` -- Test pattern for enabled_checks gating
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx` -- Pipeline validate stage for banner placement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing, no new libraries
- Architecture: HIGH -- all patterns established and verified from source code
- Pitfalls: HIGH -- derived from actual code patterns and schema structures
- New validators: HIGH -- clear pattern from 11 existing validators

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable, internal patterns)
