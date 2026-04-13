---
phase: 31
slug: validation-certificates-basic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=8.0 |
| **Config file** | backend/tests/conftest.py (exists) |
| **Quick run command** | `cd backend && python -m pytest tests/test_certificate_builder.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_certificate_builder.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_generate_certificate_pdf -x` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_pass -x` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_rejects_fail -x` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_contains_required_fields -x` | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_deterministic -x` | ❌ W0 | ⬜ pending |
| 31-02-03 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_changes_on_tamper -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_certificate_builder.py` — stubs for CERT-01, CERT-02
- [ ] Test fixtures for mock validation run data (adapt from existing `test_report_builder.py` fixtures)

*Existing infrastructure covers framework and config — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Certificate PDF visual quality | CERT-01 | Visual layout validation | Generate certificate, open PDF, verify branding/layout/readability |
| Generate Certificate button appears on passed runs | CERT-01 | UI integration | Navigate to passed validation run, verify button visible and clickable |
| Certificate downloads in browser | CERT-01 | Browser download behavior | Click Generate Certificate, verify PDF downloads with correct filename |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
