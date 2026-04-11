---
phase: 9
slug: reports-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend, if needed) |
| **Config file** | backend/pytest.ini or pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/test_reports.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_reports.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DASH-04 | unit | `pytest tests/test_pdf_report.py` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | DASH-05 | unit | `pytest tests/test_pdf_report.py` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | FILE-05 | unit | `pytest tests/test_export.py` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | DASH-04 | integration | `manual + API test` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_pdf_report.py` — stubs for PDF generation (DASH-04, DASH-05)
- [ ] `tests/test_export.py` — stubs for CSV/Excel export (FILE-05)
- [ ] `fpdf2` and `openpyxl` added to requirements.txt

*Wave 0 creates test stubs; actual implementation fills them in Wave 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual layout | DASH-05 | Visual quality check | Download PDF, verify sections: summary, methodology, issue table, pass/fail status |
| Excel cell highlighting | FILE-05 | Visual formatting | Download Excel, verify red/yellow cell fills on flagged rows |
| Download button UX | DASH-04 | Browser interaction | Click download buttons, verify file saves correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
