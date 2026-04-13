---
phase: 33
slug: validation-certificates-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.0+ (backend) + vitest (frontend) |
| **Config file** | backend/pytest.ini, vitest.config.ts |
| **Quick run command** | `cd backend && python -m pytest tests/test_certificate_builder.py tests/test_certificate_revocation.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_certificate_builder.py tests/test_certificate_revocation.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 0 | CERT-03 | unit | `cd backend && python -m pytest tests/test_certificate_builder.py::test_qr_code_in_pdf -x` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 0 | CERT-05 | unit | `cd backend && python -m pytest tests/test_certificate_revocation.py -x` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 0 | CERT-04 | integration | Manual verification (Next.js server component, public page) | N/A | ⬜ pending |
| 33-02-02 | 02 | 0 | CERT-05 | unit | `npx vitest run tests/certificates --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_certificate_builder.py` — stubs for CERT-03 (QR code generation, PDF embedding)
- [ ] `backend/tests/test_certificate_revocation.py` — stubs for CERT-05 (revocation logic, status transitions)
- [ ] `pip install qrcode[pil]` — QR code generation dependency
- [ ] `tests/certificates/` — frontend test directory for registry UI

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Public verify page renders correctly | CERT-04 | Server component with Supabase query, public route | 1. Navigate to /verify/{valid-cert-id}. 2. Verify green "Verified" card with details. 3. Navigate to /verify/{revoked-id}. 4. Verify red "Revoked" state. 5. Navigate to /verify/nonexistent. 6. Verify "not found" message. |
| QR code scannable on printed PDF | CERT-03 | Physical QR scanning | 1. Generate a certificate PDF. 2. Print or view on screen. 3. Scan QR with phone camera. 4. Verify it opens the correct verify URL. |
| Revocation confirmation dialog | CERT-05 | Interactive UI flow | 1. Open certificate registry as admin. 2. Click ... menu on active cert. 3. Click Revoke. 4. Verify confirmation dialog with reason field. 5. Enter reason, confirm. 6. Verify status changes to "Revoked". |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
