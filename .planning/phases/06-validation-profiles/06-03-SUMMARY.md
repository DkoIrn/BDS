---
phase: 06-validation-profiles
plan: 03
subsystem: ui
tags: [react, profiles, threshold-editor, select, validation-config]

# Dependency graph
requires:
  - phase: 06-validation-profiles
    plan: 01
    provides: "Backend ProfileConfig, templates, enabled_checks filtering"
  - phase: 06-validation-profiles
    plan: 02
    provides: "Frontend types, templates, CRUD actions, API config passthrough"
provides:
  - "ProfileSelector grouped dropdown with defaults/custom sections"
  - "ThresholdEditor inline panel with range, statistical, KP, and check toggle inputs"
  - "Config validation gating on Run QC button"
  - "Profile CRUD UX (save, edit, delete custom profiles)"
  - "Auto-suggestion of template based on column mappings"
---

## What was built

Complete validation profile UI system integrated into the file detail page:

1. **ProfileSelector** (`src/components/files/profile-selector.tsx`) — grouped dropdown with DEFAULTS (4 templates) and MY PROFILES sections, Customize toggle, Save as Profile flow, edit/delete with inline confirmation
2. **ThresholdEditor** (`src/components/files/threshold-editor.tsx`) — expandable panel with range threshold inputs, statistical settings (z-score, IQR), KP settings, enabled check toggles, Reset to Defaults, inline validation errors
3. **FileDetailView wiring** (`src/components/files/file-detail-view.tsx`) — profile state management, auto-suggestion on mount, config validation gating Run QC, config passthrough to /api/validate

## Key files

### Created
- `src/components/files/profile-selector.tsx` — Profile dropdown + CRUD UX
- `src/components/files/threshold-editor.tsx` — Threshold configuration panel

### Modified
- `src/components/files/file-detail-view.tsx` — Profile state, auto-suggest, config validation, Run QC wiring

## Deviations
- Threshold editor shows ALL template ranges (not just mapped columns) with unmapped ones dimmed — better UX than hiding ranges entirely

## Self-Check: PASSED
- [x] ProfileSelector renders grouped dropdown
- [x] ThresholdEditor renders range/stat/KP/check inputs
- [x] Inline validation catches invalid configs (min > max)
- [x] Run QC disabled when config errors exist
- [x] Profile save/edit/delete works via server actions
- [x] Config flows through to /api/validate
- [x] TypeScript compiles clean
- [x] Human verified end-to-end flow
