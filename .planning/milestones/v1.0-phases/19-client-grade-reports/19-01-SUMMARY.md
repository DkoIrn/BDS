---
phase: 19-client-grade-reports
plan: 01
title: "Chart Builder & Report Modes"
subsystem: backend-reports
tags: [pdf, charts, matplotlib, executive-mode, technical-mode, soq, branding]
dependency_graph:
  requires: [report_builder.py, fpdf2]
  provides: [chart_builder.py, executive-mode, technical-mode, statement-of-quality, truqc-branding]
  affects: [reports-router, pdf-generation]
tech_stack:
  added: [matplotlib]
  patterns: [Figure-not-pyplot, tempfile-chart-embedding, mode-branching]
key_files:
  created:
    - backend/app/services/chart_builder.py
    - backend/tests/test_chart_builder.py
  modified:
    - backend/requirements.txt
    - backend/app/services/report_builder.py
    - backend/app/routers/reports.py
    - backend/tests/test_report_builder.py
decisions:
  - "Use matplotlib Figure directly (not pyplot) for thread safety in FastAPI"
  - "Temp file approach for PIL-to-FPDF image embedding (fpdf2 image() needs file path)"
  - "Executive mode returns early after top issues + SoQ (no methodology, no full table)"
  - "KP density uses scatter strip plot (y-axis hidden) for compact visualization"
metrics:
  duration: "5min"
  completed: "2026-04-09T11:57:44Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 31
  files_changed: 6
---

# Phase 19 Plan 01: Chart Builder & Report Modes Summary

Matplotlib-based chart builder service with severity donut pie and KP density scatter, plus executive/technical PDF report modes with Statement of Quality and TruQC branding.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Chart builder service and tests | 509c6aa | chart_builder.py, test_chart_builder.py, requirements.txt |
| 2 | Report modes, SoQ, chart embedding, API update | d2f37e4 | report_builder.py, reports.py, test_report_builder.py |

## What Was Built

### Chart Builder Service (chart_builder.py)
- `generate_severity_pie(critical, warning, info)` -- donut chart as PIL Image, returns None when all zero
- `generate_kp_density_chart(issues)` -- scatter strip chart showing issue hotspots along KP axis, returns None when no KP data
- Headless matplotlib (Agg backend) with Figure-not-pyplot pattern for Railway/server safety

### Extended Report Builder (report_builder.py)
- **Executive mode**: Verdict box, KV summary, severity pie, top 3 issues (critical-first), Statement of Quality -- 1-2 pages
- **Technical mode**: Everything above plus severity bars, category table, column summary, KP density chart, methodology, full issues table -- multi-page
- **Statement of Quality**: Professional paragraph with verdict, pass rate, dataset scope, issue count, optional triage summary
- **Validated by TruQC badge**: Teal-bordered rectangle with bold text, date, and run reference
- **Branding**: All references updated from "DataFlow" to "TruQC"

### API Endpoint Updates (reports.py)
- `mode` query param: `executive` or `technical` (default: technical)
- `triage_accepted`, `triage_rejected`, `triage_deferred` optional int params
- Content-Disposition filename includes mode: `qc-executive-{id}.pdf` or `qc-technical-{id}.pdf`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- 31 tests pass (8 chart builder + 23 report builder)
- Executive PDF confirmed concise (page count <= 2)
- Technical PDF includes methodology, detailed issues, KP density
- "TruQC" appears in PDFs, "DataFlow" does not
- Backward compatibility: default mode=technical, existing tests still pass
- Pre-existing failures in parse_dispatch tests (unrelated to this plan) noted but not in scope
