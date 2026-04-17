# Phase 37: Context-Aware QC - Research

**Researched:** 2026-04-15
**Domain:** Pipeline survey validation with zone-based threshold modifiers
**Confidence:** HIGH

## Summary

Context-Aware QC adds the ability to define KP-range zones (e.g., shore approach KP 0-2, trench crossing KP 15-18) where validation thresholds are automatically relaxed or tightened. The existing validation pipeline (`run_validation_pipeline`) iterates per-column with a flat config dict of thresholds. Context-awareness requires intercepting this config resolution to apply zone-specific modifier overrides when a row's KP falls within a defined zone.

The architecture builds directly on Phase 36's custom rule infrastructure -- both use JSON-defined conditional logic, Supabase storage with RLS, and the same API proxy pattern. The key difference is that context rules modify *existing* validator thresholds rather than defining new standalone checks. The implementation needs: (1) a `context_zones` DB table storing zone definitions with threshold modifiers, (2) a backend service that slices the DataFrame by KP ranges and runs validators with modified configs per zone, (3) a frontend UI for defining zones and event-conditional rules, and (4) pre-configured domain QC packs with common pipeline context rules.

**Primary recommendation:** Implement context zones as threshold modifier overlays on the existing `ProfileConfig`, resolved per-row by KP value. Do NOT restructure the validation pipeline -- wrap it with a zone-aware dispatcher that splits the DataFrame by zone, applies modified configs, and merges results.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTXQ-01 | User can define context zones/segments with associated threshold modifiers | DB table `context_zones` + zone editor UI with KP range inputs and threshold modifier controls |
| CTXQ-02 | Validators apply context-specific thresholds instead of global defaults when context match exists | Backend `apply_context_zones()` service that segments DataFrame by KP ranges and modifies `flat_config` per zone before calling validators |
| CTXQ-03 | User can define event-conditional rules (e.g., "if event = trench crossing, relax depth thresholds") | Event-conditional zone type that matches on event_listing column value instead of KP range |
| CTXQ-04 | Domain QC packs include pre-configured context rules for common pipeline scenarios | Preset context zone definitions for shore approach, trench crossing, J-tube, and span regions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pandas | existing | DataFrame slicing by KP range for zone-aware validation | Already in use for all validators |
| Pydantic | existing | ContextZone and ThresholdModifier models | Matches existing ProfileConfig/CustomRuleDefinition pattern |
| Supabase | existing | context_zones table with RLS | Matches custom_rules table pattern exactly |
| shadcn/ui | existing | Zone editor UI components (Card, Select, Input, Switch) | Consistent with validate stage UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Zone/segment icons (MapPin, Layers, GitBranch) | UI visual indicators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-row threshold lookup | Split DataFrame by zone | Split approach reuses existing validators unchanged; per-row requires rewriting every validator |
| Separate context_zones table | Embed zones in validation_profiles config | Separate table enables sharing zones across profiles and org-level presets |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/schemas.py          # Add ContextZone, ThresholdModifier models
├── services/context_zones.py  # Zone resolution + config modification logic
├── routers/context_zones.py   # CRUD API for zones
supabase/migrations/
├── 20260417_context_zones.sql # DB table + RLS
src/
├── lib/types/context-zones.ts        # TypeScript zone types
├── lib/actions/context-zones.ts      # Server actions for zone CRUD
├── lib/validation/context-presets.ts  # Pre-configured domain zone packs
├── app/api/context-zones/route.ts    # API proxy routes
├── app/(dashboard)/pipeline/components/
│   ├── zone-editor/zone-editor.tsx     # Main zone editor component
│   ├── zone-editor/zone-row.tsx        # Single zone definition row
│   └── zone-editor/threshold-modifier.tsx  # Modifier input controls
```

### Pattern 1: Zone-Aware Validation Dispatch
**What:** Split DataFrame into zone-matched and unmatched segments, apply modified configs per zone, merge issues
**When to use:** During `_legacy_validation_background` after resolving ProfileConfig but before calling `run_validation_pipeline`
**Example:**
```python
# In backend/app/services/context_zones.py

from app.models.schemas import ProfileConfig, RangeThreshold

@dataclass
class ContextZone:
    """A zone definition with threshold modifiers."""
    id: str
    name: str
    zone_type: str  # "kp_range" or "event_match"
    kp_start: float | None = None
    kp_end: float | None = None
    event_value: str | None = None
    threshold_modifiers: dict[str, float] = field(default_factory=dict)
    # modifiers are multipliers: {"dob_max": 1.5} means relax dob_max by 50%

def apply_context_zones(
    df: pd.DataFrame,
    column_mappings: list[dict],
    base_config: dict,
    enabled_checks: dict,
    zones: list[ContextZone],
    kp_column: str | None,
) -> list[ValidationIssue]:
    """Run validation with context-aware thresholds.
    
    For each zone, creates a modified config, filters DataFrame rows,
    and runs validators on that subset. Non-zone rows use base config.
    """
    all_issues = []
    
    # Track which row indices are covered by zones
    covered_indices = set()
    
    for zone in zones:
        zone_mask = _get_zone_mask(df, zone, kp_column)
        if not zone_mask.any():
            continue
        
        zone_df = df[zone_mask].copy()
        covered_indices.update(zone_df.index)
        
        # Apply threshold modifiers to base config
        zone_config = _modify_config(base_config, zone.threshold_modifiers)
        
        zone_issues = run_validation_pipeline(
            zone_df, column_mappings, zone_config, enabled_checks
        )
        
        # Tag issues with zone context
        for issue in zone_issues:
            issue.message = f"[{zone.name}] {issue.message}"
        
        all_issues.extend(zone_issues)
    
    # Run base config on uncovered rows
    uncovered_mask = ~df.index.isin(covered_indices)
    if uncovered_mask.any():
        uncovered_df = df[uncovered_mask].copy()
        all_issues.extend(
            run_validation_pipeline(
                uncovered_df, column_mappings, base_config, enabled_checks
            )
        )
    
    return all_issues


def _get_zone_mask(
    df: pd.DataFrame,
    zone: ContextZone,
    kp_column: str | None,
) -> pd.Series:
    """Return boolean mask for rows matching a zone."""
    if zone.zone_type == "kp_range" and kp_column and kp_column in df.columns:
        kp = pd.to_numeric(df[kp_column], errors="coerce")
        return (kp >= zone.kp_start) & (kp <= zone.kp_end)
    
    if zone.zone_type == "event_match":
        # Match rows where any event_listing column contains the value
        for col in df.columns:
            if "event" in col.lower():
                mask = df[col].astype(str).str.lower().str.contains(
                    zone.event_value.lower(), na=False
                )
                if mask.any():
                    return mask
        return pd.Series([False] * len(df), index=df.index)
    
    return pd.Series([False] * len(df), index=df.index)


def _modify_config(base_config: dict, modifiers: dict[str, float]) -> dict:
    """Apply multiplier modifiers to a flat config dict.
    
    modifiers keys match config keys (e.g., "dob_max", "zscore_threshold").
    Values are multipliers: 1.2 = relax by 20%, 0.8 = tighten by 20%.
    """
    modified = dict(base_config)
    for key, multiplier in modifiers.items():
        if key in modified and isinstance(modified[key], (int, float)):
            modified[key] = modified[key] * multiplier
    return modified
```

### Pattern 2: Event-Conditional Rules (CTXQ-03)
**What:** Zones triggered by event column values instead of KP ranges
**When to use:** When users need rules like "if event = trench crossing, relax depth thresholds by 20%"
**Example:**
```python
# Same ContextZone model with zone_type="event_match"
# event_value="trench crossing" matches rows where event_listing contains that text
# threshold_modifiers={"depth_max": 1.2, "dob_max": 1.5}
```

### Pattern 3: Domain QC Preset Zones (CTXQ-04)
**What:** Pre-configured context zone templates for common pipeline scenarios
**When to use:** Bundled with domain QC packs, user can apply them to any profile
**Example:**
```python
# In backend/app/services/context_zone_presets.py
PRESET_ZONES = {
    "shore-approach": {
        "name": "Shore Approach",
        "description": "Relaxed depth/DOB thresholds near shore (KP 0-2)",
        "zone_type": "kp_range",
        "kp_start": 0.0,
        "kp_end": 2.0,
        "threshold_modifiers": {
            "dob_max": 1.5,    # 50% more lenient on DOB max
            "depth_max": 1.3,  # 30% more lenient on depth
        },
    },
    "trench-crossing": {
        "name": "Trench Crossing",
        "description": "Relaxed DOB thresholds during trench crossings",
        "zone_type": "event_match",
        "event_value": "trench crossing",
        "threshold_modifiers": {
            "dob_max": 2.0,    # Double DOB tolerance
            "depth_max": 1.5,
        },
    },
    "j-tube": {
        "name": "J-Tube Entry/Exit",
        "description": "Tighter DOB/DOC thresholds at J-tube transitions",
        "zone_type": "event_match",
        "event_value": "j-tube",
        "threshold_modifiers": {
            "dob_max": 0.7,    # 30% tighter DOB
            "doc_max": 0.7,
        },
    },
    "span": {
        "name": "Free Span",
        "description": "Relaxed DOB but tighter depth monitoring at spans",
        "zone_type": "event_match",
        "event_value": "span",
        "threshold_modifiers": {
            "dob_max": 3.0,     # DOB expected to be 0 at spans
            "depth_max": 0.9,   # Slightly tighter depth
        },
    },
}
```

### Anti-Patterns to Avoid
- **Per-row config lookup in validators:** Would require rewriting every validator to accept row-level configs. Instead, split DataFrame by zone and reuse validators unchanged.
- **Storing zone definitions inside ProfileConfig:** Would make profiles bloated and prevent sharing zones across profiles. Use a separate table.
- **Absolute threshold overrides instead of multipliers:** Multipliers are portable across different base profiles; absolute values would break when switching templates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zone overlap resolution | Custom priority system | Last-defined-wins with warning | Simple, predictable; complex priority systems confuse users |
| KP range validation | Custom range parser | Pydantic validators with min <= max check | Already have RangeThreshold pattern |
| Zone CRUD API | New pattern | Copy custom_rules router pattern exactly | Proven proxy + server action + RLS pattern |
| Threshold modifier UI | Complex form builder | Simple key-value inputs with multiplier display | Users need to see "DOB max: 3.0 -> 4.5 (+50%)" |

**Key insight:** The entire context zone feature is architecturally a "config modifier layer" on top of existing validators. The validators themselves should not change at all.

## Common Pitfalls

### Pitfall 1: Breaking Existing Validation When No Zones Defined
**What goes wrong:** Refactoring `run_validation_pipeline` to always require zone resolution, breaking all non-zone validation paths
**Why it happens:** Eagerness to integrate deeply
**How to avoid:** Zone resolution is opt-in. When `context_zone_ids` is empty or None, skip zone logic entirely and call `run_validation_pipeline` with the original config. This is the same pattern used for `custom_rule_ids`.
**Warning signs:** Existing tests failing after zone integration

### Pitfall 2: DataFrame Index Issues After Slicing
**What goes wrong:** Row numbers in ValidationIssue become incorrect because sliced DataFrames have non-contiguous indices
**Why it happens:** `df[mask]` preserves original indices, but validators may use iloc-based indexing
**How to avoid:** Use `.copy()` on zone-sliced DataFrames. Existing validators already use `int(idx) + 1` for row_number which works with original indices preserved.
**Warning signs:** Row numbers in zone-specific issues don't match actual data rows

### Pitfall 3: Overlapping Zones Double-Flagging
**What goes wrong:** A row at KP 1.5 falls in both "shore approach (0-2)" and "j-tube (1.0-1.8)" zones, getting validated twice with different thresholds
**Why it happens:** No zone priority or overlap resolution
**How to avoid:** Process zones in order; once a row index is covered by a zone, exclude it from subsequent zones (first-match-wins). Document this behavior clearly in the UI.
**Warning signs:** Duplicate issues for the same row with different zone tags

### Pitfall 4: Event Column Name Mismatch
**What goes wrong:** Event-conditional zones fail because the event column has varied names (event, event_listing, Event Type, etc.)
**Why it happens:** Hard-coding column name lookup
**How to avoid:** Use the column_mappings to find the event_listing mapped column, same pattern as KP column resolution in `_find_kp_column`
**Warning signs:** Event zones matching zero rows despite visible event data

### Pitfall 5: Modifier Values Confusion (Multiplier vs Absolute)
**What goes wrong:** User enters "5" meaning "set DOB max to 5m" but system interprets it as "multiply DOB max by 5x"
**Why it happens:** Ambiguous modifier semantics
**How to avoid:** Always use multiplier semantics in the backend, but display the UI as percentage change with computed result preview. Show "DOB max: 3.0m x 1.5 = 4.5m" in the zone editor.
**Warning signs:** User confusion, unexpected threshold values

## Code Examples

### Database Migration
```sql
-- context_zones: zone definitions with threshold modifiers
CREATE TABLE public.context_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.validation_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    zone_type TEXT NOT NULL CHECK (zone_type IN ('kp_range', 'event_match')),
    kp_start FLOAT,
    kp_end FLOAT,
    event_value TEXT,
    threshold_modifiers JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    is_preset BOOLEAN DEFAULT false,
    preset_id TEXT,  -- e.g., 'shore-approach', null for custom zones
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_kp_range CHECK (
        zone_type != 'kp_range' OR (kp_start IS NOT NULL AND kp_end IS NOT NULL AND kp_start <= kp_end)
    ),
    CONSTRAINT valid_event CHECK (
        zone_type != 'event_match' OR event_value IS NOT NULL
    )
);

CREATE INDEX idx_context_zones_profile_id ON public.context_zones(profile_id);
CREATE INDEX idx_context_zones_org_id ON public.context_zones(org_id);

ALTER TABLE public.context_zones ENABLE ROW LEVEL SECURITY;

-- RLS policies mirror custom_rules exactly
CREATE POLICY "Org members can view context zones"
ON public.context_zones FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Reviewers and admins can create context zones"
ON public.context_zones FOR INSERT
WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'reviewer')
));

CREATE POLICY "Owner can update context zones"
ON public.context_zones FOR UPDATE
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner or admin can delete context zones"
ON public.context_zones FOR DELETE
USING (user_id = auth.uid() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE TRIGGER handle_context_zones_updated_at
    BEFORE UPDATE ON public.context_zones
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Pydantic Models
```python
# In backend/app/models/schemas.py

class ContextZoneDefinition(BaseModel):
    name: str
    description: str = ""
    zone_type: Literal["kp_range", "event_match"]
    kp_start: float | None = None
    kp_end: float | None = None
    event_value: str | None = None
    threshold_modifiers: dict[str, float] = {}  # key: config param, value: multiplier

    @model_validator(mode="after")
    def validate_zone_type(self):
        if self.zone_type == "kp_range":
            if self.kp_start is None or self.kp_end is None:
                raise ValueError("kp_range zone requires kp_start and kp_end")
            if self.kp_start > self.kp_end:
                raise ValueError("kp_start must be <= kp_end")
        elif self.zone_type == "event_match":
            if not self.event_value:
                raise ValueError("event_match zone requires event_value")
        return self
```

### ValidateRequest Extension
```python
# Add to ValidateRequest in schemas.py
class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None
    secondary_dataset_id: str | None = None
    cross_dataset_config: CrossDatasetConfig | None = None
    custom_rule_ids: list[str] | None = None
    context_zone_ids: list[str] | None = None  # NEW
```

### Integration Point in Validation Router
```python
# In _legacy_validation_background, replace the direct run_validation_pipeline call:

# Resolve validation config
profile_config = config or ProfileConfig()
flat_config, enabled_checks = resolve_config(profile_config)

# Context-aware validation (when zones are provided)
if context_zone_ids:
    from app.services.context_zones import apply_context_zones, load_zones
    zones = load_zones(supabase, context_zone_ids)
    issues = apply_context_zones(
        df, mappings, flat_config, enabled_checks, zones, kp_column
    )
else:
    issues = run_validation_pipeline(df, mappings, flat_config, enabled_checks)
```

### Frontend Zone Editor UI Structure
```typescript
// TypeScript types for context zones
interface ContextZone {
  id: string
  profile_id: string
  name: string
  description: string
  zone_type: "kp_range" | "event_match"
  kp_start?: number
  kp_end?: number
  event_value?: string
  threshold_modifiers: Record<string, number> // multipliers
  enabled: boolean
  is_preset: boolean
  preset_id?: string
}

// Available threshold modifier keys (matching flat_config keys)
const MODIFIABLE_THRESHOLDS = [
  { key: "dob_max", label: "DOB Maximum", unit: "m" },
  { key: "dob_min", label: "DOB Minimum", unit: "m" },
  { key: "doc_max", label: "DOC Maximum", unit: "m" },
  { key: "depth_max", label: "Depth Maximum", unit: "m" },
  { key: "zscore_threshold", label: "Z-Score Threshold", unit: "" },
  { key: "iqr_multiplier", label: "IQR Multiplier", unit: "" },
  { key: "kp_gap_max", label: "KP Gap Max", unit: "km" },
] as const
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global thresholds for entire dataset | Zone-specific threshold modifiers | This phase | Reduces false positives in complex pipeline routes |
| Manual filtering before validation | Automatic KP/event-based segmentation | This phase | Users don't need to split files by zone |
| Hard-coded gradient limits in spike detection | Configurable gradient multipliers per zone | This phase | Trench crossings and shore approaches no longer flood issues |

## Open Questions

1. **Zone overlap resolution strategy**
   - What we know: First-match-wins is simplest and predictable
   - What's unclear: Whether users expect priority-based resolution (lower sort_order wins) or UI-enforced non-overlap
   - Recommendation: Use sort_order for priority (lower = higher priority). First-match-wins with covered_indices tracking. Show warning in UI when zones overlap.

2. **Client-side zone preview**
   - What we know: Client-side validation exists in `client-validate.ts`
   - What's unclear: Whether zones should also apply to client-side quick validation
   - Recommendation: Skip client-side zone support for v1. Context zones are a backend-only feature applied during full validation runs. Client-side validation remains a quick preview.

3. **Preset zone KP ranges**
   - What we know: Preset zones like "shore approach" need default KP ranges, but these vary per project
   - What's unclear: Whether preset KP ranges should be editable or just templates
   - Recommendation: Presets provide default KP values that users must confirm/adjust before saving. The preset populates the form but user saves their own copy with project-specific ranges.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend) |
| Config file | backend/pytest.ini / vitest.config.ts |
| Quick run command | `cd backend && python -m pytest tests/test_context_zones.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTXQ-01 | Zone CRUD and validation models | unit | `cd backend && python -m pytest tests/test_context_zones.py::test_zone_crud -x` | Wave 0 |
| CTXQ-02 | Zone-aware validation applies modified thresholds | unit | `cd backend && python -m pytest tests/test_context_zones.py::test_apply_context_zones -x` | Wave 0 |
| CTXQ-03 | Event-conditional zones match on event column | unit | `cd backend && python -m pytest tests/test_context_zones.py::test_event_match_zone -x` | Wave 0 |
| CTXQ-04 | Preset zones load and produce correct modifiers | unit | `cd backend && python -m pytest tests/test_context_zones.py::test_preset_zones -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_context_zones.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_context_zones.py` -- covers CTXQ-01 through CTXQ-04
- [ ] Test fixtures for zone definitions and sample DataFrames with KP + event columns

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/services/validation.py` -- current validation pipeline structure
- Existing codebase: `backend/app/services/custom_rules.py` -- Phase 36 pattern for JSON-defined rules
- Existing codebase: `backend/app/services/templates.py` -- ProfileConfig resolution and flat_config pattern
- Existing codebase: `backend/app/models/schemas.py` -- Pydantic models and ValidateRequest
- Existing codebase: `supabase/migrations/20260416_custom_rules.sql` -- DB table + RLS pattern to replicate

### Secondary (MEDIUM confidence)
- Domain knowledge: Pipeline survey scenarios (shore approach, trench crossing, J-tube, span) are standard engineering zones where QC thresholds legitimately vary

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; extends existing patterns
- Architecture: HIGH - Zone-aware dispatch pattern is a clean wrapper around existing validators
- Pitfalls: HIGH - DataFrame indexing and zone overlap are well-understood edge cases
- Domain presets: MEDIUM - Specific modifier values for shore approach/trench/J-tube are reasonable defaults but may need tuning with real survey data

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable -- no external dependency changes expected)
