---
phase: 35-cross-dataset-validation
plan: "01"
subsystem: backend-validation
tags: [cross-dataset, kp-alignment, presets, validators]
dependency_graph:
  requires: []
  provides: [cross-dataset-validator, cross-validation-presets, cross-dataset-api]
  affects: [validation-pipeline, validation-runs-schema]
tech_stack:
  added: []
  patterns: [merge_asof-kp-alignment, preset-driven-validation, synonym-column-detection]
key_files:
  created:
    - backend/app/validators/cross_dataset.py
    - backend/app/services/cross_validation_presets.py
    - backend/tests/validators/test_cross_dataset.py
    - backend/tests/fixtures/cross_dataset/dob_sample.csv
    - backend/tests/fixtures/cross_dataset/doc_sample.csv
    - supabase/migrations/20260414_cross_dataset_validation.sql
  modified:
    - backend/app/models/schemas.py
    - backend/app/routers/validation.py
decisions:
  - "merge_asof with direction=nearest for KP alignment -- handles different sampling rates"
  - "Coverage gap detection uses min/max KP range comparison per dataset"
  - "Cross-dataset issues use row_number=0 with populated kp_value for KP-based references"
  - "Column name resolution tries capitalized and uppercase variants for merged DataFrame lookup"
metrics:
  duration: "5 minutes"
  completed: "2026-04-15"
  tasks_completed: 2
  tasks_total: 2
  test_count: 16
  files_created: 6
  files_modified: 2
---

# Phase 35 Plan 01: Cross-Dataset Validation Backend Summary

Cross-dataset validator with KP-aligned comparison, two domain presets (DOB vs DOC, Position vs Event), column auto-detection via synonym lookup, and API endpoint extension accepting secondary_dataset_id.

## What Was Built

### Cross-Dataset Validator (`backend/app/validators/cross_dataset.py`)
- `align_by_kp()` -- merges two DataFrames using `pd.merge_asof` with configurable tolerance and nearest-direction matching
- `check_value_delta()` -- flags rows where absolute column difference exceeds tolerance
- `check_relationship()` -- flags rows where relationship constraint is violated (e.g., DOB >= DOC)
- `check_coverage_gaps()` -- flags KP ranges present in one dataset but missing from the other
- `run_cross_dataset_checks()` -- orchestrator that aligns, checks coverage, and runs per-column-pair checks from preset

### Cross-Validation Presets (`backend/app/services/cross_validation_presets.py`)
- `CrossValidationPreset` dataclass with id, name, dataset types, column pairs, and KP alignment tolerance
- `PRESETS` dict with `dob_vs_doc` (5 checks) and `position_vs_event` (3 checks)
- `COLUMN_SYNONYMS` dict for 9 column types with common survey naming variations
- `auto_match_columns()` -- matches columns between datasets using normalized synonym lookup
- `get_preset_for_types()` -- auto-selects preset from dataset type label pair (both orderings)

### Database Migration (`supabase/migrations/20260414_cross_dataset_validation.sql`)
- Adds `secondary_dataset_id UUID REFERENCES datasets(id)` nullable column to `validation_runs`
- Adds `cross_validation_config JSONB` nullable column for config snapshot storage
- Partial index on `secondary_dataset_id WHERE NOT NULL` for query performance

### API Extension (`backend/app/routers/validation.py`)
- `ValidateRequest` extended with `secondary_dataset_id` and `cross_dataset_config`
- `CrossDatasetConfig` schema: preset_id, dataset_type_a/b, column_mapping, tolerances
- Background task fetches secondary dataset, auto-detects columns, selects preset, runs cross-checks
- Cross-dataset issues merged into same issue batch -- single issue stream for frontend
- Backward compatible: single-dataset flow unchanged when `secondary_dataset_id` is null

### Tests (16 passing)
- KP alignment: merge, unmatched NaN, tight tolerance exclusion
- Delta checks: exceeding tolerance, within tolerance
- Relationship checks: DOC > DOB flagged, DOB >= DOC passes
- Coverage gaps: range detection, no false positives
- Preset integration: DOB vs DOC, Position vs Event
- Column auto-detection: synonym matching, unknown columns
- Issue format: rule_type, row_number, kp_value
- Tolerance overrides: config values override preset defaults

## Deviations from Plan

None -- plan executed exactly as written.

## Discovered Issues (Out of Scope)

- Pre-existing test failure in `tests/parsers/test_parse_dispatch.py::TestDispatchParser::test_unsupported_extension_raises` -- not related to this plan's changes.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| feda8a2 | test | Add failing tests for cross-dataset validator (RED) |
| 3623abb | feat | Implement cross-dataset validator with presets and column auto-detection (GREEN) |
| e1bbe6d | feat | Add DB migration and API endpoint for cross-dataset validation |

## Self-Check: PASSED
