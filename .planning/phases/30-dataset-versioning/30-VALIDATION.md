---
phase: 30
slug: dataset-versioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | `backend/pyproject.toml` [tool.pytest.ini_options] |
| **Quick run command** | `cd backend && python -m pytest tests/test_versioning.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_versioning.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | DVER-01 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_create_snapshot -x` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | DVER-02 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_list_versions -x` | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | DVER-03 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_compute_diff -x` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | DVER-04 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_version_issue_count -x` | ❌ W0 | ⬜ pending |
| 30-01-05 | 01 | 1 | DVER-05 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_auto_prune -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_versioning.py` — stubs for DVER-01 through DVER-05
- [ ] `backend/tests/fixtures/version_test_data/` — sample CSV files for diff testing
- [ ] Test mocking for Supabase storage upload/download (follow pattern from existing conftest.py)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Versions tab renders in dataset detail | DVER-02 | UI rendering, no frontend test framework | Open dataset detail, verify Versions tab appears between Preview and Audit |
| Trend summary header displays correctly | DVER-02 | UI layout verification | Check version count, issue trend arrow, row count delta |
| Checkbox selection + Compare button UX | DVER-03 | Interactive UI behavior | Select 2 versions, verify Compare button enables, click to view diff |
| Diff drill-down expand/collapse | DVER-03 | Interactive UI behavior | Expand modified rows section, verify inline before/after format |
| Version appears after validation completes | DVER-01 | End-to-end flow | Run validation, check Versions tab shows new entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
