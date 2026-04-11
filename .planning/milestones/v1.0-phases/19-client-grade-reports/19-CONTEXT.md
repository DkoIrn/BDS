# Phase 19: Client-Grade Reports - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing fpdf2 PDF report system with two report modes (Executive and Technical), embed visual QC summary charts (matplotlib, server-side), and auto-generate a Statement of Quality section with branded certification. This phase does NOT add frontend chart components or a new chart library — all visualizations are generated server-side and embedded in the PDF.

</domain>

<decisions>
## Implementation Decisions

### Report Modes & Content
- Two modes: Executive (1-2 page summary) and Technical (full multi-page detail)
- Executive: Verdict, pass rate, severity pie chart, top 3 issues, Statement of Quality
- Technical: Everything in Executive PLUS full issue breakdowns, KP density chart, column analysis, methodology details, issues table (capped at 500, note to download CSV/Excel for complete list)
- Same branded header/footer for both modes — Executive says "QC Summary Report", Technical says "QC Technical Report"
- Both modes share the same PDF generation pipeline, controlled by a `mode` parameter

### Visual QC Summaries
- Charts generated server-side with matplotlib in Python, embedded as images in the PDF
- No frontend chart library (no Recharts) — keeps scope tight, PDF-only charts
- Two charts: (1) Severity breakdown pie chart (critical/warning/info), (2) Issue density along KP (scatter/bar showing where issues cluster)
- Executive report gets severity pie only; Technical gets both charts
- If no KP data exists in the dataset, omit KP density chart and add text note: "KP density chart unavailable — no KP data in dataset"

### Statement of Quality
- Auto-generated section in both report modes
- Content: Pass/Fail verdict with pass rate, what checks were run and thresholds used, dataset scope (rows, columns, file name, date)
- Reads like a professional QC certification paragraph (not a legal template)
- Includes "Validated by TruQC" branded badge/stamp visual element
- References triage decisions when available: "X issues identified, Y accepted for remediation, Z rejected as false positives, W deferred"
- Triage summary omitted if Review stage was skipped

### Report UX & Delivery
- Existing "Download PDF Report" button becomes a dropdown: "Executive Report" / "Technical Report"
- Reports available from both pipeline Export stage AND results dashboard ExportButtons
- No preview — direct download on click
- Pipeline export passes triage decision counts (accepted/rejected/deferred) to the report API alongside run_id
- Report API endpoint adds `?mode=executive|technical` query parameter

### Claude's Discretion
- Matplotlib chart styling (colors, fonts, sizing to match PDF brand)
- Exact layout of the "Validated by TruQC" badge/stamp
- Page breaks and section ordering within each mode
- How triage counts are formatted in the SoQ paragraph text
- Severity pie chart style (donut vs filled pie)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `report_builder.py` (backend/app/services/report_builder.py): QCReport class with fpdf2, branded styling, section methods — extend with mode parameter and chart embedding
- `reports.py` router (backend/app/routers/reports.py): PDF streaming endpoint — add mode query param
- `ExportButtons` (src/components/files/export-buttons.tsx): PDF/CSV/Excel download buttons — convert PDF button to dropdown
- `stage-export.tsx`: Pipeline export with QC Report download — add mode dropdown here too
- Brand colors already defined in report_builder.py: BRAND_DARK, severity colors, etc.

### Established Patterns
- PDF generation: fpdf2 with custom header/footer, section methods, severity color coding
- API flow: Frontend → Next.js proxy route → FastAPI endpoint → stream PDF binary
- Unicode sanitization: `_sanitize()` method handles encoding for Helvetica font
- Issues capped at 500 in PDF with truncation warning (existing behavior)

### Integration Points
- `generate_pdf_report(run_data, issues, dataset_name)` — add `mode` and `triage_counts` parameters
- `/api/v1/report/pdf/{run_id}` — add `?mode=executive|technical` and optional `triage_accepted`, `triage_rejected`, `triage_deferred` query params
- `/api/reports/pdf/route.ts` (Next.js proxy) — pass mode and triage params through
- `ExportButtons` component — convert single PDF button to split/dropdown
- Pipeline state `triageDecisions` — compute counts and pass to report API on export

</code_context>

<specifics>
## Specific Ideas

- The severity pie chart should use the same brand colors already defined in report_builder.py (red for critical, amber for warning, blue for info)
- The "Validated by TruQC" stamp should feel professional — think engineering certification stamps, not marketing badges
- Executive report should be concise enough to attach to a client email as a quick QC summary
- The KP density chart should clearly show hot spots where issues cluster — engineers use this to prioritize field work
- Triage summary in SoQ adds credibility: shows human review happened, not just automated flags

</specifics>

<deferred>
## Deferred Ideas

- Frontend dashboard charts (Recharts) for interactive QC visualization — separate phase
- Report preview modal before download
- Custom report templates / configurable section ordering
- Validation certificates as standalone 1-page PDFs
- Compare reports across multiple validation runs

</deferred>

---

*Phase: 19-client-grade-reports*
*Context gathered: 2026-04-09 via discuss-phase*
