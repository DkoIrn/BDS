---
phase: 35-cross-dataset-validation
plan: "02"
subsystem: frontend-pipeline
tags: [cross-dataset, dual-import, pipeline-ui, tolerances]
dependency_graph:
  requires: [cross-dataset-validator, cross-validation-presets, cross-dataset-api]
  provides: [dual-file-import-ui, cross-validation-config-ui, cross-dataset-issue-display]
  affects: [pipeline-state, stage-import, stage-validate, issues-table]
tech_stack:
  added: []
  patterns: [reducer-extension, dual-dropzone, preset-auto-select, tolerance-config]
key_files:
  created:
    - src/app/(dashboard)/pipeline/lib/cross-validation-presets.ts
  modified:
    - src/app/(dashboard)/pipeline/lib/pipeline-state.ts
    - src/app/(dashboard)/pipeline/components/stage-import.tsx
    - src/app/(dashboard)/pipeline/components/stage-validate.tsx
    - src/app/(dashboard)/pipeline/pipeline-workflow.tsx
    - src/components/files/issues-table.tsx
    - src/app/api/v1/validate/route.ts
    - src/app/api/validate/route.ts
decisions:
  - "PRESET_MAP lookup auto-selects cross-validation preset from dataset type pair"
  - "Dual dropzones use grid-cols-2 layout on lg screens, stack on mobile"
  - "Cross-dataset mode requires both files before advancing to inspect stage"
  - "Cross-dataset issues display with indigo badges and KP-based references (row_number=0)"
  - "secondFileRef passed from pipeline-workflow to stage-import for second file reference"
metrics:
  duration: "8 minutes"
  commits: 3
  files_changed: 8
  lines_added: ~700
  lines_removed: ~27
---

## What Was Built

Extended the frontend pipeline to support cross-dataset validation mode with dual-file import, preset auto-selection, cross-validation tolerance configuration, and cross-dataset issue display.

## Key Changes

### Pipeline State (pipeline-state.ts)
- Added `DatasetTypeLabel` type and cross-dataset fields to `PipelineState`
- New actions: `TOGGLE_CROSS_DATASET`, `IMPORT_SECOND_FILE`, `IMPORT_SECOND_EXISTING`, `INSPECT_SECOND_COMPLETE`, `SET_DATASET_TYPE`, `SET_CROSS_TOLERANCE`
- `PRESET_MAP` constant maps type pairs (e.g., "DOB|DOC") to preset IDs
- Cross-dataset mode requires both files before advancing past import stage

### Import Stage (stage-import.tsx)
- Toggle switch at top: "Single File" / "Cross-Dataset" mode
- Dual side-by-side dropzones with dataset type Select dropdowns
- Info banner when matching preset auto-detected
- Existing dataset picker works for both files
- Single-file mode completely unchanged when toggle is off

### Validate Stage (stage-validate.tsx)
- "Cross-Validation Settings" card appears below profile selector when cross-dataset mode active
- Shows preset name, column pairs with editable tolerance inputs, KP alignment tolerance
- Passes `secondary_dataset_id` and `cross_dataset_config` to API on validation

### Issues Table (issues-table.tsx)
- Added `cross_dataset` and `cross_dataset_coverage` to `RULE_LABELS` and `RULE_COLORS`
- Indigo badge styling for cross-dataset issues
- KP-based references displayed when `row_number === 0` and `kp_value` exists

### API Proxy (validate routes)
- Both `/api/validate` and `/api/v1/validate` routes pass through `secondary_dataset_id` and `cross_dataset_config`

## Verification

- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- Single-file pipeline workflow unchanged when cross-dataset mode off
- Awaiting human verification of end-to-end flow (Task 3)
