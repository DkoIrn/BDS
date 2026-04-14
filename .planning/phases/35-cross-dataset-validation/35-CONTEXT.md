# Phase 35: Cross-Dataset Validation - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can validate consistency between two related datasets (e.g., DOB vs DOC) within the standard pipeline workflow. The import stage accepts two files, both flow through QC individually then cross-validation runs between them. Results merge into the standard triage view. Covers XVAL-01 (dataset pairing), XVAL-02 (column consistency with tolerance), XVAL-03 (cross-dataset issues in triage), XVAL-04 (domain presets).

</domain>

<decisions>
## Implementation Decisions

### Dataset Pairing UX
- Cross-dataset validation lives inside the existing 6-stage pipeline (not a separate tool)
- Import stage accepts two files simultaneously — user uploads both at once
- Each file gets a dropdown label with presets: DOB, DOC, TOP, Event Listing, Position, Other
- The label selection drives which cross-validation presets apply automatically
- Pipeline runs single-dataset QC on each file first, then cross-validation between them — user sees all issues together in the review stage

### Comparison Rules & Presets
- Two presets ship out of the box: DOB vs DOC consistency, Position vs Event alignment
- Column mapping: auto-detect matching columns by name, with manual override if names differ between files
- Each preset defines which columns matter for comparison
- Tolerance: per-preset sensible defaults (e.g., DOB vs DOC ±0.1m), editable by user before running — shown in the validate stage config
- Specific check logic for each preset: Claude's discretion based on domain research

### Cross-Dataset Issue Display
- Cross-dataset issues merge into the existing grouped/flat issue list with a new "Cross-Dataset" rule type category
- Same severity badges (critical/warning/info) as single-dataset issues
- Issues use KP-based references (not row numbers) — more meaningful for survey engineers
- Issue message format: Claude's discretion (show both values, delta, or hybrid — whatever is most useful for engineering QC)
- Reports and certificates list both file names (e.g., "Cross-validation: pipeline-dob.csv vs pipeline-doc.csv")

### Claude's Discretion
- Specific checks within each preset (DOB vs DOC, Position vs Event)
- Issue message format and level of detail
- How the import stage UI changes to support two-file upload (drag zones, layout)
- Column auto-detect matching algorithm
- How cross-dataset issues integrate with existing issue clustering

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(dashboard)/pipeline/components/stage-import.tsx`: Current single-file import — needs extension for two-file upload
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx`: Validation config UI — extend with cross-validation tolerance controls
- `src/components/files/issues-table.tsx`: Grouped/flat issue view with rule type categories — add "Cross-Dataset" as new rule type
- `src/components/files/issue-cluster.tsx`: Issue clustering — cross-dataset issues need to participate
- `backend/app/routers/validate.py`: Validation endpoint — extend to accept two datasets
- `backend/app/services/validators/`: Individual validator modules — add cross-dataset validators alongside existing ones
- `src/lib/types/validation.ts`: ValidationIssue type — may need cross-dataset fields (source_dataset, target_dataset)

### Established Patterns
- Validators are modular Python functions in `backend/app/services/validators/`
- Issues stored in `validation_issues` table with rule_type, severity, message, row_number, column_name, kp_value
- Pipeline state managed via reducer in `pipeline-workflow.tsx`
- Validation profiles with configurable checks and tolerances

### Integration Points
- `src/app/(dashboard)/pipeline/components/stage-import.tsx`: Two-file upload UI
- `src/app/(dashboard)/pipeline/components/stage-validate.tsx`: Cross-validation config and tolerance controls
- `backend/app/routers/validate.py`: Accept paired datasets for cross-validation
- `src/components/files/issues-table.tsx`: Display cross-dataset issues in existing view
- `src/components/files/results-dashboard.tsx`: Include cross-dataset stats in results summary

</code_context>

<specifics>
## Specific Ideas

- Dropdown labels on uploaded files (DOB, DOC, TOP, etc.) should auto-select the right preset — if user picks "DOB" and "DOC", the DOB vs DOC preset activates automatically
- KP-based references in issues make more engineering sense than row numbers for survey data
- Both file names should appear in reports/certificates to make it clear what was cross-validated

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-cross-dataset-validation*
*Context gathered: 2026-04-14*
