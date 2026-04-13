---
phase: 31
slug: validation-certificates-basic
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 31-01-01 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_generate_certificate_pdf -x` | W0 via TDD | ⬜ pending |
| 31-01-02 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_pass -x` | W0 via TDD | ⬜ pending |
| 31-01-03 | 01 | 1 | CERT-01 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_endpoint_rejects_fail -x` | W0 via TDD | ⬜ pending |
| 31-02-01 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_certificate_contains_required_fields -x` | W0 via TDD | ⬜ pending |
| 31-02-02 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_deterministic -x` | W0 via TDD | ⬜ pending |
| 31-02-03 | 02 | 1 | CERT-02 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_hmac_changes_on_tamper -x` | W0 via TDD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/test_certificate_builder.py` — created by Plan 01 Task 1 (TDD task writes test stubs before implementation as its first action step)
- [x] Test fixtures for mock validation run data — created by Plan 01 Task 1 (cert_data_pass and cert_data_fail fixtures)

*Wave 0 is satisfied by Plan 01 Task 1 which is a TDD task (tdd="true"). The task writes all test stubs and fixtures in step 2 before implementing production code in step 3. This is the RED phase of RED-GREEN-REFACTOR.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Certificate PDF visual quality | CERT-01 | Visual layout validation | Generate certificate, open PDF, verify branding/layout/readability |
| Generate Certificate button appears on passed runs | CERT-01 | UI integration | Navigate to passed validation run, verify button visible and clickable |
| Certificate downloads in browser | CERT-01 | Browser download behavior | Click Generate Certificate, verify PDF downloads with correct filename |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 Task 1 TDD satisfies)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — Wave 0 satisfied by TDD task structure in Plan 01
