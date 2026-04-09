# Phase 20: Domain-Specific QC Packs - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 4 generic validation templates (DOB/DOC/TOP/General) with 3 domain-specific QC packs (Pipeline As-Laid, As-Built Survey, Pre-Commissioning) plus a General catch-all. Add 2 new chain-aware validators (KP drift, segment continuity) with configurable thresholds per pack. Extend ProfileConfig with tolerance and chain check fields. Update the profile selector UI with richer pack metadata and auto-suggestion.

</domain>

<decisions>
## Implementation Decisions

### Rule Pack Definitions
- 3 domain packs + General: Pipeline As-Laid, As-Built Survey, Pre-Commissioning, General
- Replace existing 4 templates (DOB/DOC/TOP/General) with the new packs — packs are smarter (workflow-specific, not column-type-focused)
- Each pack has: name, 1-2 line description, list of expected column types (e.g., As-Laid expects KP, DOB, depth, easting, northing)
- Packs are read-only system defaults. Users can customize thresholds and "Save as Profile" to create their own variant (existing Phase 6 pattern)

### Tolerance & Threshold Tuning
- **Pipeline As-Laid**: Tight KP + depth focus. KP gap max 0.01km, duplicate KP tolerance 0.0005km, DOB range 0-3m, depth 0-300m, monotonicity always enforced, all coordinate/position checks enabled
- **As-Built Survey**: DOC + cross-column focus. DOC range 0-2m, DOB range 0-5m, cross-column consistency critical (DOC vs DOB), coordinate sanity strict, spike detection more aggressive
- **Pre-Commissioning**: Event listing + position focus. Event_listing checks critical, position_consistency strict, looser depth/DOB tolerances, KP monotonicity enforced, coordinate jumps flagged aggressively
- Add `tolerance` field to RangeThreshold: {min, max, tolerance}. Tolerance defines acceptable deviation (e.g., DOB tolerance +/-0.1m). Extends existing schema

### Chain-Aware Checks
- 2 new validators added to the validation engine:
  1. **Cumulative KP drift** — detects when KP increments don't match actual distance between coordinates, flagging chainage errors that compound along the pipeline
  2. **Segment continuity** — checks consecutive rows maintain logical pipeline progression (no teleports, backtracking, impossible distances)
- Both enabled in all 3 packs, but severity varies:
  - As-Laid: KP drift CRITICAL (primary concern), segment continuity WARNING
  - As-Built: segment continuity CRITICAL (construction accuracy), KP drift WARNING
  - Pre-Comm: both WARNING (supplementary to event checks)
- New configurable fields in ProfileConfig:
  - `kp_drift_tolerance`: As-Laid 1%, As-Built 2%, Pre-Comm 5%. Drift = |KP increment - computed distance| / computed distance
  - `max_segment_distance`: As-Laid 50m, As-Built 100m, Pre-Comm 200m. Flags when consecutive coordinates are impossibly far apart
- Add `kp_drift` and `segment_continuity` to EnabledChecks (15 booleans total, up from 13)

### Pack Selection UX
- Extend existing profile selector dropdown — replace 4 old templates with 3 packs + General in the system section
- Each pack entry in dropdown shows inline: pack name (bold) + 1-line description + expected column pills
- New "Chain Checks" group in threshold editor with: KP drift toggle + tolerance slider, segment continuity toggle + max distance slider. Grouped separately from basic QC checks
- Auto-suggestion in pipeline Validate stage: after column mapping, if mapped columns match a pack's expected columns, show banner: "This looks like an As-Laid survey. Use As-Laid QC Pack?" with Apply button. User can dismiss

### Claude's Discretion
- Exact threshold values for z-score/IQR per pack (slight tuning from General defaults)
- Pack description text and expected column lists
- Auto-suggestion matching algorithm (column type overlap threshold)
- Threshold editor slider ranges and step sizes for new chain check fields
- How to handle packs when required columns are not mapped (warning vs block)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `templates.ts` + `templates.py` (frontend + backend): DEFAULT_TEMPLATES dict — replace entries with new pack definitions
- `ProfileConfig` schema (schemas.py + validation.ts): Extend with tolerance, kp_drift_tolerance, max_segment_distance fields
- `EnabledChecks` (schemas.py + validation.ts): Add kp_drift and segment_continuity booleans
- `profile-selector.tsx`: Extend dropdown items with description + column pills
- `threshold-editor.tsx`: Add "Chain Checks" group section
- `validation.py` service: Add kp_drift and segment_continuity to run_validation_pipeline() orchestration
- Existing validators in `backend/app/validators/`: Follow base.py pattern for new validators

### Established Patterns
- Validators follow: function takes (df, config, mappings) → returns list[ValidationIssue]
- Config resolution: ProfileConfig → resolve_config() → (flat_dict, enabled_checks_dict)
- Templates defined identically in frontend + backend (must stay in sync)
- RangeThreshold Pydantic model: extend with optional tolerance field

### Integration Points
- `run_validation_pipeline()` in validation.py: Add new validator calls gated by enabled_checks
- `resolve_config()` in templates.py: Handle new chain check config fields
- `suggestProfile()` in templates.ts: Update logic for pack auto-suggestion
- `stage-validate.tsx`: Add suggestion banner when column mappings match a pack
- Frontend + backend template sync: Both need identical pack definitions

</code_context>

<specifics>
## Specific Ideas

- Pack names should feel professional: "Pipeline As-Laid QC", "As-Built Survey QC", "Pre-Commissioning QC"
- Expected column pills in the dropdown should use the same colored badges as the column mapping UI
- The suggestion banner in the Validate stage should be dismissible and not block the workflow
- Chain check validators should produce clear messages: "KP drift of 3.2% detected between rows 45-46 (tolerance: 1%)" with the actual vs expected distances

</specifics>

<deferred>
## Deferred Ideas

- Auto-suggest based on file naming conventions (e.g., "as_laid_" prefix)
- Custom rule builder (drag-and-drop check configuration) — v2 feature
- Context-aware QC (shallow vs deep water thresholds based on depth ranges)
- Multi-file cross-dataset validation (compare as-laid vs as-built)
- ROV Inspection and Seabed/Bathymetry Survey packs — future additions

</deferred>

---

*Phase: 20-domain-qc-packs*
*Context gathered: 2026-04-09 via discuss-phase*
