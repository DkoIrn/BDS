---
phase: 19-client-grade-reports
verified: 2026-04-09T13:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Download Executive Report from results dashboard"
    expected: "1-2 page PDF with severity pie chart, verdict box, top 3 issues, Statement of Quality with 'VALIDATED BY TRUQC' badge — all rendering correctly"
    why_human: "PDF visual quality, actual page count, and chart rendering cannot be verified from static file inspection"
  - test: "Download Technical Report from results dashboard"
    expected: "Multi-page PDF with severity pie, KP density chart (if KP data present), issues by category, per-column summary, methodology, Statement of Quality, full issues table"
    why_human: "Multi-page structure and embedded chart quality require live PDF inspection"
  - test: "Pipeline export dropdown with triage data"
    expected: "QC Report dropdown appears in Pipeline Complete state; Executive report SoQ includes 'X accepted for remediation, Y rejected as false positives, Z deferred' counts"
    why_human: "Requires running a full pipeline with triage decisions, then downloading and reading the PDF"
  - test: "Dropdown UI behavior in both locations"
    expected: "PDF Report dropdown in ExportButtons and QC Report dropdown in pipeline export both open/close correctly, click-outside closes menu"
    why_human: "Interactive UI behavior requires browser testing"
---

# Phase 19: Client-Grade Reports Verification Report

**Phase Goal:** Users can download professional client-grade QC reports in two modes -- a concise Executive summary for client distribution and a detailed Technical report for engineering review -- with visual QC charts, Statement of Quality certification, and TruQC branding
**Verified:** 2026-04-09T13:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Executive mode generates concise 1-2 page PDF with verdict, pass rate, severity pie, top 3 issues, SoQ | VERIFIED | `report_builder.py` lines 312-315: early return after `_add_top_issues` + `_add_soq_section` in executive branch |
| 2 | Technical mode generates full multi-page PDF with all sections including full issue breakdowns, KP density chart, methodology, issues table | VERIFIED | `report_builder.py` lines 319-516: severity bars, category table, column summary, KP density, methodology, SoQ, detailed issues table |
| 3 | Severity pie chart is a matplotlib-rendered donut image embedded in both modes | VERIFIED | `chart_builder.py` implements `generate_severity_pie` returning PIL Image; `report_builder.py` line 308-309 calls it and embeds via `_embed_chart` in both mode paths |
| 4 | KP density chart in Technical mode; omitted with text note when no KP data | VERIFIED | `report_builder.py` lines 424-433: `generate_kp_density_chart` called; `None` result produces "KP density chart unavailable -- no KP data in dataset" text |
| 5 | Statement of Quality includes pass/fail verdict, dataset scope, checks run, triage summary when provided | VERIFIED | `_build_soq_text` (lines 132-157): verdict, pass rate, total issues, optional triage paragraph; `_add_soq_section` adds "VALIDATED BY TRUQC" badge |
| 6 | API endpoint accepts mode=executive|technical and optional triage count parameters | VERIFIED | `reports.py` lines 20-27: `mode`, `triage_accepted`, `triage_rejected`, `triage_deferred` Query params; Content-Disposition filename includes mode |
| 7 | User sees dropdown with Executive Report and Technical Report options in ExportButtons | VERIFIED | `export-buttons.tsx` lines 65-99: relative container, useState toggle, click-outside detection, two dropdown items |
| 8 | User sees same dropdown in pipeline Export stage | VERIFIED | `stage-export.tsx` lines 229-231 + 355-451: `QcReportDropdown` component rendered conditionally on `state.validationRunId` |
| 9 | Dropdown is available in both ExportButtons (results dashboard) and pipeline Export stage | VERIFIED | Both components implemented with consistent dropdown pattern |
| 10 | Pipeline export passes triage decision counts to the report API | VERIFIED | `stage-export.tsx` lines 372-391: `triageCounts` computed from `state.triageDecisions`, appended to URL when `hasTriageData` is true |
| 11 | Results dashboard export generates reports without triage data | VERIFIED | `export-buttons.tsx` line 37: URL uses only `runId` and `mode` -- no triage params |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/chart_builder.py` | matplotlib chart generation functions | VERIFIED | 137 lines; exports `generate_severity_pie` and `generate_kp_density_chart`; headless Agg backend; returns PIL Image or None |
| `backend/app/services/report_builder.py` | Extended PDF report with mode, SoQ, chart embedding | VERIFIED | 518 lines; `generate_pdf_report(run_data, issues, dataset_name, mode="technical", triage_counts=None)`; mode branching, SoQ, badge, chart embedding |
| `backend/app/routers/reports.py` | PDF endpoint with mode and triage query params | VERIFIED | Lines 20-99: Query params for mode + triage; builds triage_counts dict; passes both to `generate_pdf_report` |
| `backend/tests/test_chart_builder.py` | Chart builder unit tests | VERIFIED | 71 lines; 8 test cases covering all behaviors (None on zero, single wedge, RGB mode, size > 100) |
| `backend/tests/test_report_builder.py` | Extended report builder tests for both modes | VERIFIED | 273 lines; 23 test cases: executive mode header, no methodology, no detailed issues, concise page count, technical mode, SoQ with/without triage, TruQC branding, KP density note |
| `src/app/api/reports/pdf/route.ts` | Proxy route forwarding mode and triage params to FastAPI | VERIFIED | 103 lines; reads mode + triage params from searchParams; builds URLSearchParams; proxies to FastAPI with params; mode in Content-Disposition |
| `src/components/files/export-buttons.tsx` | PDF dropdown with Executive/Technical options | VERIFIED | 128 lines; pdfMenuOpen state, click-outside via useRef/useEffect, Executive and Technical dropdown items |
| `src/app/(dashboard)/pipeline/components/stage-export.tsx` | QC Report dropdown with triage count forwarding | VERIFIED | QcReportDropdown component (lines 355-451); triage counts computed from state; URL with triage params when hasTriageData |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/services/report_builder.py` | `backend/app/services/chart_builder.py` | `from app.services.chart_builder import generate_kp_density_chart, generate_severity_pie` | WIRED | Line 18 confirmed |
| `backend/app/routers/reports.py` | `backend/app/services/report_builder.py` | `generate_pdf_report(..., mode=mode, triage_counts=triage_counts)` | WIRED | Line 90: `generate_pdf_report(run_data, issues, dataset_name, mode=mode, triage_counts=triage_counts)` |
| `src/components/files/export-buttons.tsx` | `src/app/api/reports/pdf/route.ts` | `fetch` with `mode` query param | WIRED | Line 37: `/api/reports/pdf?runId=${runId}&mode=${mode || "technical"}` |
| `src/app/(dashboard)/pipeline/components/stage-export.tsx` | `src/app/api/reports/pdf/route.ts` | `fetch` with mode and triage params | WIRED | Lines 388-390: URL built with `mode`, `triage_accepted`, `triage_rejected`, `triage_deferred` |
| `src/app/api/reports/pdf/route.ts` | FastAPI `/api/v1/report/pdf/{run_id}` | URLSearchParams with mode and triage | WIRED | Lines 73-79: `params` built with mode + triage; passed to FastAPI fetch |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RPT-01 | 19-01-PLAN | Executive PDF mode (1-2 page concise report) | SATISFIED | `report_builder.py` executive branch with early return |
| RPT-02 | 19-01-PLAN | Technical PDF mode (full multi-page report) | SATISFIED | `report_builder.py` technical branch with all sections |
| RPT-03 | 19-01-PLAN | Matplotlib chart embedding (severity pie + KP density) | SATISFIED | `chart_builder.py` + `_embed_chart` in `report_builder.py` |
| RPT-04 | 19-01-PLAN | Statement of Quality with verdict and dataset scope | SATISFIED | `_build_soq_text` + `_add_soq_section` with VALIDATED BY TRUQC badge |
| RPT-05 | 19-01-PLAN | TruQC branding throughout (header/footer) | SATISFIED | `QCReport.header()` and `.footer()` use "TruQC"; `test_dataflow_not_in_pdf` passes |
| RPT-06 | 19-02-PLAN | Frontend dropdown with Executive/Technical options in both locations | SATISFIED | `export-buttons.tsx` and `stage-export.tsx` both implement dropdown |
| RPT-07 | 19-01-PLAN | Triage summary in Statement of Quality when counts provided | SATISFIED | `_build_soq_text` appends triage sentence when `triage_counts` provided and any value > 0 |

**DOCUMENTATION GAP:** RPT-01 through RPT-07 are referenced in ROADMAP.md (Phase 19) and in PLAN frontmatter but are NOT defined in `.planning/REQUIREMENTS.md`. The requirements document has no RPT section, no RPT entries in the traceability table, and no RPT-* definitions. The requirement IDs exist as references only. This does not block the phase goal but the REQUIREMENTS.md traceability table is incomplete.

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder returns, empty implementations, or stub handlers found in any phase 19 files.

### Human Verification Required

#### 1. Executive Report Visual Quality

**Test:** Navigate to any dataset with completed validation results. Click the "PDF Report" dropdown, select "Executive Report", and open the downloaded PDF.
**Expected:** PDF is 1-2 pages, shows: verdict box (PASS/FAIL with color), dataset name and pass rate, severity pie donut chart embedded as image, "Top Issues" section with up to 3 critical-first issues, "Statement of Quality" section with professional paragraph text, and a teal-bordered "VALIDATED BY TRUQC" badge with date and run reference.
**Why human:** PDF visual quality, chart rendering, page count, and badge appearance cannot be confirmed from static code inspection.

#### 2. Technical Report Visual Quality

**Test:** Same dataset, select "Technical Report" from dropdown.
**Expected:** Multi-page PDF. Page 1: verdict, KV rows, severity pie chart. Subsequent pages: severity breakdown bars, issues by check category table, issues by column list, KP density scatter chart (if KP data present, otherwise "KP density chart unavailable" note), methodology description, Statement of Quality with badge, full detailed issues table with row/column/severity/description.
**Why human:** Multi-page layout, embedded chart quality, and table formatting require live PDF inspection.

#### 3. Pipeline Export with Triage Data

**Test:** Run a dataset through the pipeline. In the Review stage, triage several issues (accept some, reject some, defer some). Proceed to Export, complete the export download. In the "Pipeline Complete" state, click "QC Report" dropdown and select "Executive Report".
**Expected:** PDF Statement of Quality reads "X were accepted for remediation, Y were rejected as false positives, and Z were deferred for further review" with correct counts matching triage decisions made.
**Why human:** Requires end-to-end pipeline run with real triage decisions; count accuracy verified only by reading the PDF.

#### 4. Dropdown Click-Outside Behavior

**Test:** Open the PDF dropdown in either location. Click somewhere else on the page outside the dropdown.
**Expected:** Dropdown closes without selecting a mode.
**Why human:** Interactive DOM behavior not verifiable from static code.

### Gaps Summary

No gaps found. All 11 must-have truths are verified, all artifacts exist and are substantive, all key links are wired.

The only outstanding items are human verification of PDF visual quality and interactive behavior -- which is expected for a report-generation phase. The documentation gap (RPT-* IDs not defined in REQUIREMENTS.md) is a housekeeping issue and does not affect phase goal achievement.

---

_Verified: 2026-04-09T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
