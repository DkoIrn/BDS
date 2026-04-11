---
phase: 6
slug: validation-profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | backend/tests/conftest.py |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | VALE-06 | unit | `cd backend && python -m pytest tests/test_templates.py -x` | No -- Wave 0 | ⬜ pending |
| 06-01-02 | 01 | 1 | VALE-06 | unit | `cd backend && python -m pytest tests/test_templates.py::test_template_enabled_checks -x` | No -- Wave 0 | ⬜ pending |
| 06-01-03 | 01 | 1 | VALE-08 | unit | `cd backend && python -m pytest tests/test_schemas.py -x` | No -- Wave 0 | ⬜ pending |
| 06-01-04 | 01 | 1 | VALE-08 | unit | `cd backend && python -m pytest tests/validators/test_enabled_checks.py -x` | No -- Wave 0 | ⬜ pending |
| 06-01-05 | 01 | 1 | VALE-08 | unit | `cd backend && python -m pytest tests/test_schemas.py::test_invalid_config -x` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_templates.py` — stubs for VALE-06 template definitions and config generation
- [ ] `backend/tests/test_schemas.py` — stubs for VALE-08 ProfileConfig validation
- [ ] `backend/tests/validators/test_enabled_checks.py` — stubs for VALE-08 enabled_checks filtering

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Config snapshot stored on validation_runs record | VALE-08 | Requires Supabase integration | 1. Run QC with custom thresholds 2. Check validation_runs table for config_snapshot JSONB |
| Profile dropdown auto-suggests based on column types | VALE-06 | UI interaction + column detection integration | 1. Upload DOB file 2. Verify DOB Survey profile is pre-selected |
| Inline threshold panel expand/collapse | VALE-08 | Visual/interaction behavior | 1. Click Customize 2. Verify panel expands with correct fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
