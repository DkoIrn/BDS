# Phase 35: Cross-Dataset Validation - Research

**Researched:** 2026-04-14
**Domain:** Cross-dataset comparison logic, multi-file pipeline UX, survey data consistency
**Confidence:** HIGH

## Summary

Cross-dataset validation extends the existing single-dataset pipeline to accept two files, run individual QC on each, then run comparison checks between them. The existing architecture is well-structured for this: validators are modular Python functions in `backend/app/validators/`, issues use a standardized `ValidationIssue` dataclass with `rule_type` for grouping, and the frontend issues table already groups by `rule_type` with color-coded badges.

The core challenge is threefold: (1) extending the import stage to accept two files with dataset type labels, (2) creating a new `cross_dataset` validator module that compares two DataFrames row-by-row using KP-aligned matching, and (3) merging cross-dataset issues into the existing issue stream with a new "cross_dataset" rule_type category. The existing `consistency.py` validator (cross-column checks within a single dataset) provides a strong pattern to follow.

**Primary recommendation:** Add a `cross_dataset.py` validator module following the same pattern as `consistency.py`, extend `PipelineState` to hold two files/DataFrames, and use KP-based row alignment (merge on nearest KP) as the join strategy between datasets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Cross-dataset validation lives inside the existing 6-stage pipeline (not a separate tool)
- Import stage accepts two files simultaneously -- user uploads both at once
- Each file gets a dropdown label with presets: DOB, DOC, TOP, Event Listing, Position, Other
- The label selection drives which cross-validation presets apply automatically
- Pipeline runs single-dataset QC on each file first, then cross-validation between them -- user sees all issues together in the review stage
- Two presets ship out of the box: DOB vs DOC consistency, Position vs Event alignment
- Column mapping: auto-detect matching columns by name, with manual override if names differ between files
- Each preset defines which columns matter for comparison
- Tolerance: per-preset sensible defaults (e.g., DOB vs DOC +/-0.1m), editable by user before running -- shown in the validate stage config
- Cross-dataset issues merge into the existing grouped/flat issue list with a new "Cross-Dataset" rule type category
- Same severity badges (critical/warning/info) as single-dataset issues
- Issues use KP-based references (not row numbers) -- more meaningful for survey engineers
- Issue message format: Claude's discretion (show both values, delta, or hybrid -- whatever is most useful for engineering QC)
- Reports and certificates list both file names (e.g., "Cross-validation: pipeline-dob.csv vs pipeline-doc.csv")

### Claude's Discretion
- Specific checks within each preset (DOB vs DOC, Position vs Event)
- Issue message format and level of detail
- How the import stage UI changes to support two-file upload (drag zones, layout)
- Column auto-detect matching algorithm
- How cross-dataset issues integrate with existing issue clustering

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XVAL-01 | User can select two datasets within the same job for cross-dataset validation | Pipeline state extended with secondFile/secondParsedData; import stage gets dual dropzone with dataset type labels |
| XVAL-02 | System validates column-to-column consistency between paired datasets with configurable tolerance | New `cross_dataset.py` validator with tolerance params in ProfileConfig; KP-based row alignment |
| XVAL-03 | Cross-dataset issues appear in the standard triage view under a "Cross-Dataset" category | New rule_type "cross_dataset" with entries in RULE_LABELS/RULE_COLORS; ValidationIssue fields sufficient as-is |
| XVAL-04 | Domain-specific cross-dataset presets exist (DOB vs DOC consistency, position vs event alignment) | Preset definitions as typed dicts; auto-selection from dataset type label combinations |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pandas | existing | DataFrame alignment via merge_asof for KP-based row matching | Already in stack, native merge_asof for nearest-key joins |
| react-dropzone | existing | Multi-file upload support | Already used in stage-import.tsx, supports multiple files |
| FastAPI | existing | Extended validation endpoint | Already the backend framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | existing | Vectorized delta computation between aligned columns | Already a pandas dependency |

No new libraries needed. Everything required is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/validators/
  cross_dataset.py          # NEW: cross-dataset comparison logic
backend/app/services/
  validation.py             # EXTEND: add run_cross_validation()
  cross_validation_presets.py  # NEW: preset definitions
backend/app/models/
  schemas.py                # EXTEND: CrossValidateRequest, CrossDatasetConfig
backend/app/routers/
  validation.py             # EXTEND: /api/v1/cross-validate endpoint

src/app/(dashboard)/pipeline/
  lib/pipeline-state.ts     # EXTEND: second file state
  components/stage-import.tsx  # EXTEND: dual file upload
  components/stage-validate.tsx  # EXTEND: cross-validation config UI

src/lib/types/validation.ts   # EXTEND: cross-dataset issue fields (optional)
src/components/files/issues-table.tsx  # EXTEND: cross_dataset rule type labels/colors
```

### Pattern 1: KP-Based Row Alignment (Critical)
**What:** When comparing two datasets (e.g., DOB survey vs DOC survey), rows don't match by index. They match by KP (kilometer point). Use pandas `merge_asof` to align rows by nearest KP within a tolerance.
**When to use:** Every cross-dataset comparison
**Example:**
```python
import pandas as pd

def align_by_kp(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    kp_col_a: str,
    kp_col_b: str,
    tolerance: float = 0.01,  # km
) -> pd.DataFrame:
    """Align two DataFrames by nearest KP value.
    
    Returns merged DataFrame with suffixes _a and _b for overlapping columns.
    Rows from df_a that have no match within tolerance are kept with NaN for _b columns.
    """
    a = df_a.sort_values(kp_col_a).reset_index(drop=True)
    b = df_b.sort_values(kp_col_b).reset_index(drop=True)
    
    merged = pd.merge_asof(
        a, b,
        left_on=kp_col_a, right_on=kp_col_b,
        tolerance=tolerance,
        direction="nearest",
        suffixes=("_a", "_b"),
    )
    return merged
```

### Pattern 2: Preset-Driven Validation
**What:** Each dataset type pair (e.g., DOB+DOC) maps to a preset that defines which columns to compare, what checks to run, and default tolerances.
**When to use:** When user selects dataset type labels
**Example:**
```python
from dataclasses import dataclass, field

@dataclass
class CrossValidationPreset:
    id: str
    name: str
    dataset_a_type: str  # e.g., "DOB"
    dataset_b_type: str  # e.g., "DOC"
    column_pairs: list[dict]  # [{"a": "dob", "b": "doc", "check": "delta", "tolerance": 0.1}]
    kp_alignment_tolerance: float = 0.01  # km

PRESETS = {
    "dob_vs_doc": CrossValidationPreset(
        id="dob_vs_doc",
        name="DOB vs DOC Consistency",
        dataset_a_type="DOB",
        dataset_b_type="DOC",
        column_pairs=[
            {"a": "kp", "b": "kp", "check": "coverage", "description": "KP coverage alignment"},
            {"a": "dob", "b": "doc", "check": "a_gte_b", "tolerance": 0.0, "description": "DOB >= DOC (burial must exceed cover)"},
            {"a": "dob", "b": "dob", "check": "delta", "tolerance": 0.1, "description": "DOB agreement between surveys"},
            {"a": "easting", "b": "easting", "check": "delta", "tolerance": 1.0, "description": "Easting agreement"},
            {"a": "northing", "b": "northing", "check": "delta", "tolerance": 1.0, "description": "Northing agreement"},
        ],
        kp_alignment_tolerance=0.01,
    ),
    "position_vs_event": CrossValidationPreset(
        id="position_vs_event",
        name="Position vs Event Alignment",
        dataset_a_type="Position",
        dataset_b_type="Event Listing",
        column_pairs=[
            {"a": "kp", "b": "kp", "check": "event_coverage", "description": "Events have matching positions"},
            {"a": "easting", "b": "easting", "check": "delta", "tolerance": 5.0, "description": "Position agreement at event KPs"},
            {"a": "northing", "b": "northing", "check": "delta", "tolerance": 5.0, "description": "Position agreement at event KPs"},
        ],
        kp_alignment_tolerance=0.05,
    ),
}
```

### Pattern 3: Extending ValidationIssue for Cross-Dataset Context
**What:** Cross-dataset issues use the existing `ValidationIssue` dataclass but encode both-dataset context in the message and column_name fields. No schema migration needed.
**When to use:** All cross-dataset issues
**Example:**
```python
# Use rule_type = "cross_dataset" for all cross-dataset issues
# Encode source info in column_name as "dob(DOB)/doc(DOC)" 
# Use kp_value for KP-based references (not row_number)

ValidationIssue(
    row_number=0,  # Not meaningful for cross-dataset; KP is the reference
    column_name="dob(DOB)/doc(DOC)",
    rule_type="cross_dataset",
    severity=Severity.CRITICAL,
    message="DOB vs DOC mismatch at KP 12.450: DOB=1.2m (DOB survey) vs DOC=1.5m (DOC survey) -- DOC exceeds DOB by 0.3m",
    expected="DOB >= DOC",
    actual="DOB=1.2m, DOC=1.5m, delta=-0.3m",
    kp_value=12.450,
)
```

### Pattern 4: Column Auto-Detection
**What:** Match columns between two datasets by normalized name similarity. Survey columns often have slight naming variations (e.g., "KP" vs "Chainage", "DOB" vs "Depth_of_Burial").
**When to use:** When datasets are first paired, before validation runs
**Example:**
```python
# Normalize column names for matching
COLUMN_SYNONYMS = {
    "kp": ["kp", "chainage", "station", "km_point", "kilometre_point"],
    "dob": ["dob", "depth_of_burial", "burial_depth", "burial"],
    "doc": ["doc", "depth_of_cover", "cover_depth", "cover"],
    "easting": ["easting", "east", "e", "x"],
    "northing": ["northing", "north", "n", "y"],
    "depth": ["depth", "water_depth", "seabed_depth"],
}

def auto_match_columns(
    headers_a: list[str],
    headers_b: list[str],
) -> list[dict]:
    """Return list of matched column pairs based on name similarity."""
    matches = []
    normalized_a = {h: h.lower().strip().replace(" ", "_") for h in headers_a}
    normalized_b = {h: h.lower().strip().replace(" ", "_") for h in headers_b}
    
    for col_type, synonyms in COLUMN_SYNONYMS.items():
        match_a = next((orig for orig, norm in normalized_a.items() if norm in synonyms), None)
        match_b = next((orig for orig, norm in normalized_b.items() if norm in synonyms), None)
        if match_a and match_b:
            matches.append({"type": col_type, "col_a": match_a, "col_b": match_b})
    
    return matches
```

### Anti-Patterns to Avoid
- **Row-index alignment:** Never match rows between datasets by index. Survey datasets have different row counts and sampling intervals. Always use KP-based alignment.
- **Modifying ValidationIssue schema:** Adding new fields to the dataclass would require a DB migration. Instead, encode cross-dataset context in existing string fields (message, column_name, expected, actual).
- **Separate cross-dataset issue storage:** Don't create a new table. Cross-dataset issues go into the same `validation_issues` table with `rule_type = "cross_dataset"`. This means they automatically appear in the existing triage view.
- **Blocking single-file pipeline:** The two-file upload mode must be optional. Users who upload one file get the existing behavior unchanged.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KP-based row alignment | Custom loop matching nearest KP | `pd.merge_asof()` | Handles tolerance, direction, edge cases, O(n log n) performance |
| Multi-file drag-and-drop | Custom drag event handlers | react-dropzone with `multiple: true` | Already in stack, handles browser edge cases |
| Column name normalization | Complex regex matching | Synonym lookup table | Deterministic, easy to extend, no false positives |

## Common Pitfalls

### Pitfall 1: KP Alignment Tolerance Too Tight
**What goes wrong:** Datasets from different surveys may have KP values that differ by small amounts due to measurement precision. If tolerance is too tight (e.g., 0.0001 km), most rows won't match.
**Why it happens:** Different survey instruments record KP at different precisions.
**How to avoid:** Default KP alignment tolerance of 0.01 km (10m) for same-pipeline surveys. Make it configurable per preset. The DOB vs DOC preset should use 0.01 km; position vs event should use 0.05 km (events are less precisely positioned).
**Warning signs:** Most cross-validation issues are "no matching KP found" rather than actual discrepancies.

### Pitfall 2: Column Name Mismatch Between Surveys
**What goes wrong:** Two surveys of the same pipeline use different column names for the same measurement (e.g., "Burial Depth" vs "DOB"). Auto-detection fails, and comparison runs with wrong columns or no columns.
**Why it happens:** No industry standard for CSV column naming in survey data.
**How to avoid:** Auto-detect with synonym table first, then show the column mapping UI with manual override dropdowns before running validation.
**Warning signs:** Cross-validation returns zero issues (nothing was compared because no columns matched).

### Pitfall 3: Pipeline State Complexity Explosion
**What goes wrong:** Adding a second file to PipelineState doubles the state surface area: two file names, two parsedData arrays, two column counts, two row counts, two sets of column mappings.
**Why it happens:** The state was designed for single-file workflow.
**How to avoid:** Group second-file state under a single `secondDataset` object in PipelineState rather than adding individual fields. This keeps the state flat for the primary file (backward compatible) and bundles secondary file state cleanly.
**Warning signs:** State reducer becomes complex with many new action types.

### Pitfall 4: Issue Message Confusion
**What goes wrong:** Cross-dataset issues show "Row 0" or a row number that doesn't correspond to anything meaningful in either dataset.
**Why it happens:** The ValidationIssue dataclass requires row_number (int), but cross-dataset issues reference KP positions, not rows.
**How to avoid:** Set row_number to 0 for cross-dataset issues and always populate kp_value. The frontend already handles kp_value display. Add a special case in the issue display to hide "Row 0" when rule_type is "cross_dataset".
**Warning signs:** Users see "Row 0" in the issue list and are confused.

### Pitfall 5: Unmatched KP Regions
**What goes wrong:** Dataset A covers KP 0-50 and Dataset B covers KP 20-70. The non-overlapping regions (0-20, 50-70) generate no comparison issues, silently skipping validation.
**Why it happens:** merge_asof only matches within tolerance; unmatched rows from the left table get NaN for right columns.
**How to avoid:** Add a "coverage gap" check that flags KP ranges present in one dataset but not the other. This is a separate check type within the cross-dataset validator.
**Warning signs:** Users expect issues in non-overlapping regions but see none.

## Code Examples

### Cross-Dataset Validator Core Logic
```python
# backend/app/validators/cross_dataset.py
def run_cross_dataset_checks(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    preset: CrossValidationPreset,
    column_mapping: list[dict],  # manual overrides
    config: dict,  # user-adjusted tolerances
) -> list[ValidationIssue]:
    """Compare two aligned DataFrames using preset-defined checks."""
    issues = []
    
    # 1. Align by KP
    kp_tol = config.get("kp_alignment_tolerance", preset.kp_alignment_tolerance)
    merged = align_by_kp(df_a, df_b, "kp", "kp", tolerance=kp_tol)
    
    # 2. Coverage gap check
    issues.extend(check_coverage_gaps(df_a, df_b, "kp", preset))
    
    # 3. Run each column pair check
    for pair in preset.column_pairs:
        col_a = resolve_column(pair["a"], column_mapping, "a")
        col_b = resolve_column(pair["b"], column_mapping, "b")
        tolerance = config.get(f"{pair['a']}_{pair['b']}_tolerance", pair.get("tolerance", 0.0))
        
        if pair["check"] == "delta":
            issues.extend(check_value_delta(merged, col_a, col_b, tolerance, preset))
        elif pair["check"] == "a_gte_b":
            issues.extend(check_relationship(merged, col_a, col_b, ">=", tolerance, preset))
        elif pair["check"] == "coverage":
            pass  # handled above
    
    return issues
```

### Extended Pipeline State
```typescript
// Additions to PipelineState
interface PipelineState {
  // ... existing fields ...
  
  // Cross-dataset mode
  crossDatasetMode: boolean
  secondFileName: string | null
  secondParsedData: string[][] | null
  secondColumnCount: number | null
  secondRowCount: number | null
  datasetTypeA: DatasetTypeLabel | null  // "DOB" | "DOC" | "TOP" | "Event Listing" | "Position" | "Other"
  datasetTypeB: DatasetTypeLabel | null
  crossValidationPreset: string | null  // auto-selected from type labels
  crossValidationTolerance: Record<string, number>  // user-editable overrides
}

type DatasetTypeLabel = "DOB" | "DOC" | "TOP" | "Event Listing" | "Position" | "Other"
```

### Dual File Import UI Concept
```typescript
// In stage-import.tsx, when cross-dataset mode is active:
// Two side-by-side dropzones, each with a dataset type dropdown
// Layout: 
//   [Toggle: Single File | Cross-Dataset]
//   [Dropzone A + Type Dropdown] [Dropzone B + Type Dropdown]
//   [Auto-selected preset banner]
```

### Frontend Issue Display Extension
```typescript
// Add to RULE_LABELS in issues-table.tsx
const RULE_LABELS = {
  // ... existing ...
  cross_dataset: "Cross-Dataset",
  cross_dataset_coverage: "Coverage Gap",
}

// Add to RULE_COLORS
const RULE_COLORS = {
  // ... existing ...
  cross_dataset: "bg-indigo-50 text-indigo-600",
  cross_dataset_coverage: "bg-indigo-50 text-indigo-600",
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Excel comparison | Automated KP-aligned comparison | This phase | Eliminates hours of manual cross-referencing |
| Row-by-row index matching | KP-based nearest-match alignment | N/A | Handles different sampling rates between surveys |
| Separate comparison tool | Integrated into pipeline workflow | Decision from CONTEXT.md | Single workflow, no context switching |

## Open Questions

1. **Client-side cross-validation for uploaded files**
   - What we know: Single-file pipeline supports both client-side validation (uploaded files) and backend validation (existing datasets). Cross-dataset comparison is more complex.
   - What's unclear: Should cross-validation always go through the backend, or should we support client-side cross-validation for uploaded file pairs?
   - Recommendation: Backend only for cross-validation. The KP alignment and multi-DataFrame logic is complex and benefits from pandas. Send both files to backend even for uploads.

2. **Database schema for cross-dataset validation runs**
   - What we know: `validation_runs` has a single `dataset_id` FK. Cross-validation involves two datasets.
   - What's unclear: Should we add a `secondary_dataset_id` column to `validation_runs`, or create a separate `cross_validation_runs` table?
   - Recommendation: Add `secondary_dataset_id UUID REFERENCES datasets(id)` nullable column to `validation_runs`. Simpler than a new table; null for single-dataset runs, populated for cross-dataset runs. Requires a migration.

3. **How cross-dataset issues interact with certificates**
   - What we know: Certificates reference a single dataset. Cross-validation spans two.
   - What's unclear: Should certificates include cross-validation results? How to label them?
   - Recommendation: Include both file names in certificate when cross-validation was performed. The CONTEXT.md explicitly states this: "Reports and certificates list both file names."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), vitest (frontend -- inferred from existing test structure) |
| Config file | `backend/pytest.ini` or `backend/pyproject.toml` |
| Quick run command | `cd backend && python -m pytest tests/validators/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XVAL-01 | Two datasets can be paired with type labels | integration | `cd backend && python -m pytest tests/test_cross_validation.py::test_pair_datasets -x` | Wave 0 |
| XVAL-02 | Column-to-column consistency with tolerance | unit | `cd backend && python -m pytest tests/validators/test_cross_dataset.py -x` | Wave 0 |
| XVAL-03 | Cross-dataset issues in triage view with correct rule_type | unit | `cd backend && python -m pytest tests/validators/test_cross_dataset.py::test_issue_rule_type -x` | Wave 0 |
| XVAL-04 | DOB vs DOC and Position vs Event presets | unit | `cd backend && python -m pytest tests/validators/test_cross_dataset.py::test_presets -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/validators/test_cross_dataset.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/validators/test_cross_dataset.py` -- unit tests for cross-dataset validator (XVAL-02, XVAL-03, XVAL-04)
- [ ] `backend/tests/test_cross_validation.py` -- integration test for cross-validation endpoint (XVAL-01)
- [ ] `backend/tests/fixtures/cross_dataset/` -- sample DOB and DOC CSV pairs for testing

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/validators/consistency.py` -- cross-column pattern to follow
- Existing codebase: `backend/app/validators/base.py` -- ValidationIssue dataclass
- Existing codebase: `backend/app/services/validation.py` -- validation pipeline orchestration
- Existing codebase: `src/app/(dashboard)/pipeline/lib/pipeline-state.ts` -- pipeline state machine
- Existing codebase: `src/components/files/issues-table.tsx` -- rule_type grouping and display
- Existing codebase: `backend/app/routers/validation.py` -- validation endpoint pattern
- pandas merge_asof: standard API for nearest-key joins (well-documented, stable)

### Secondary (MEDIUM confidence)
- Pipeline survey domain knowledge: DOB vs DOC relationships, KP alignment requirements, tolerance values
- Survey column naming conventions: derived from existing COLUMN_SYNONYMS in project + domain expertise

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, extending existing patterns
- Architecture: HIGH -- clear extension points identified in codebase, patterns well-established
- Pitfalls: HIGH -- derived from concrete codebase analysis and survey domain knowledge
- Domain presets: MEDIUM -- specific tolerance values and check logic based on domain knowledge, may need tuning

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable -- internal architecture, no external dependencies)
