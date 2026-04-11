# Phase 16: Pipeline Workflow - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a guided pipeline workflow page where users process datasets through a 5-stage linear flow: **Import → Inspect → Validate → Clean → Export**. The pipeline orchestrates existing features (file upload, data preview, QC engine, transform tools, format conversion) into a single cohesive experience with a visual progress stepper.

This phase does NOT build new processing capabilities — it wires together features from phases 3, 8, 11, 12, 13, and 14 into a guided flow.

</domain>

<decisions>
## Implementation Decisions

### Workflow Stages (5-stage detailed)
- **Import:** Upload files (CSV, Excel, GeoJSON) or select from existing project datasets
- **Inspect:** Preview data table, column stats, row count, detect column types, flag obvious format issues
- **Validate:** Run QC rule templates against the dataset, review flagged anomalies with explanations
- **Clean:** Apply fixes (remove rows, fill gaps, transform CRS, merge columns), preview before/after
- **Export:** Choose output format, download cleaned dataset, optionally generate QC report

### Location
- Dedicated `/pipeline` page (new top-level route in dashboard layout)
- Full-width layout with a horizontal stepper/progress bar at the top
- Add "Pipeline" to the top navbar as a primary navigation item

### Stage Gating (Smart gating)
- Import is always required (can't skip — need data to work with)
- Inspect is automatic after import (always runs, shows preview)
- Validate is optional but shows a caution/warning if skipped ("Dataset not validated — proceed with care")
- Clean is optional (only needed if validation found issues or user wants transforms)
- Export is always available once data is imported (even without validation)
- Users can jump back to any completed stage to re-do it

### Progress & State
- Visual stepper shows current stage, completed stages (checkmark), and skipped stages (warning icon)
- Pipeline state persists in session so users can leave and return
- Each stage shows a summary of what was done when revisited

### Claude's Discretion
- Stepper component design (horizontal top bar vs sidebar steps)
- Transition animations between stages
- How to handle large datasets in the inspect stage (pagination, virtual scroll)
- Error recovery if a stage fails mid-processing

</decisions>

<specifics>
## Specific Ideas

- The stepper should feel like a professional engineering workflow (think FME Workbench, not a shopping checkout)
- Each stage should show a clear "Continue" / "Skip" action at the bottom
- The Validate stage should reuse the existing QC validation API (`/api/validate`)
- The Clean stage should reuse transform tools from Phase 14
- The Export stage should reuse format conversion from Phase 12
- Import should support both drag-and-drop upload AND selecting an existing dataset from projects

</specifics>

<deferred>
## Deferred Ideas

- Saving pipeline configurations as reusable templates
- Batch processing multiple files through the same pipeline
- Pipeline history / audit log
- AI-assisted auto-clean suggestions

</deferred>

---

*Phase: 16-pipeline-workflow*
*Context gathered: 2026-03-31 via discuss-phase*
