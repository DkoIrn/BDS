---
phase: 19
slug: client-grade-reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework configured (manual browser testing + PDF inspection) |
| **Config file** | none |
| **Quick run command** | Manual: generate PDF, open and inspect |
| **Full suite command** | Full pipeline walkthrough with both report modes |
| **Estimated runtime** | ~3 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual test of affected report functionality
- **After every plan wave:** Generate both Executive and Technical PDFs, inspect all sections
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | Chart generation | manual | Generate PDF with matplotlib charts, inspect | N/A | ⬜ pending |
| 19-01-02 | 01 | 1 | Report mode routing | manual | Call API with mode=executive and mode=technical | N/A | ⬜ pending |
| 19-02-01 | 02 | 2 | Executive report content | manual | Download Executive PDF, verify 1-2 pages with pie chart + SoQ | N/A | ⬜ pending |
| 19-02-02 | 02 | 2 | Technical report content | manual | Download Technical PDF, verify full detail + both charts | N/A | ⬜ pending |
| 19-02-03 | 02 | 2 | Statement of Quality | manual | Verify SoQ section with branded stamp + triage counts | N/A | ⬜ pending |
| 19-02-04 | 02 | 2 | Frontend dropdown | manual | Verify PDF button dropdown in ExportButtons + stage-export | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. matplotlib needs installing but that's a task dependency, not a test infrastructure gap.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Severity pie chart renders correctly | Chart generation | Visual PDF inspection | Generate Technical PDF, verify pie chart shows correct severity proportions |
| KP density chart renders correctly | Chart generation | Visual PDF inspection | Generate Technical PDF with KP data, verify scatter chart shows issue clustering |
| KP chart omitted when no KP data | Conditional chart | Requires dataset without KP | Validate dataset without KP column, generate Technical PDF, verify chart replaced by text note |
| Executive is 1-2 pages | Report mode | Page count visual check | Download Executive PDF, verify concise layout |
| Technical has full detail | Report mode | Content visual check | Download Technical PDF, verify all sections present with issues table |
| "Validated by TruQC" stamp | SoQ branding | Visual design element | Inspect SoQ section for branded stamp/badge |
| Triage counts in SoQ | SoQ content | Requires pipeline with Review | Run full pipeline with triage, export report, verify SoQ mentions accepted/rejected/deferred |
| Dropdown on PDF button | Frontend UX | UI interaction | Click PDF export button, verify dropdown with Executive/Technical options |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual test per task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
