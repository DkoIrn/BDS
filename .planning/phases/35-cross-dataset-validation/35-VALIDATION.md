---
phase: 35
slug: cross-dataset-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.0+ (backend) + vitest (frontend) |
| **Config file** | backend/pytest.ini, vitest.config.ts |
| **Quick run command** | `cd backend && python -m pytest tests/test_cross_validation.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command for the relevant layer (backend or frontend)
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | XVAL-02 | unit | `cd backend && python -m pytest tests/test_cross_validation.py -x` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | XVAL-04 | unit | `cd backend && python -m pytest tests/test_cross_validation.py::test_dob_doc_preset -x` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 2 | XVAL-01 | unit | `npx vitest run tests/cross-validation --reporter=verbose` | ❌ W0 | ⬜ pending |
| 35-02-02 | 02 | 2 | XVAL-03 | unit | `npx vitest run tests/cross-validation/issue-display.test.tsx --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_cross_validation.py` — stubs for XVAL-02, XVAL-04 (cross-validation logic, presets)
- [ ] `tests/cross-validation/` — frontend test directory for pipeline UI changes
- [ ] Test fixtures: paired CSV files (DOB + DOC with matching KP column)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-file upload in pipeline import | XVAL-01 | UI interaction with drag-drop | 1. Go to pipeline. 2. Upload two CSV files. 3. Verify both appear with dropdown labels. |
| Cross-dataset issues in triage view | XVAL-03 | Visual layout validation | 1. Run cross-validation on paired files. 2. Verify "Cross-Dataset" category appears in issue groups. 3. Verify KP-based references. |
| Preset auto-selection from labels | XVAL-04 | UI interaction flow | 1. Upload two files. 2. Label one DOB, other DOC. 3. Verify DOB vs DOC preset auto-activates in validate stage. |
| Tolerance editing | XVAL-02 | UI interaction | 1. Select a preset. 2. Verify tolerance defaults shown. 3. Change tolerance. 4. Run validation. 5. Verify changed tolerance applied. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
