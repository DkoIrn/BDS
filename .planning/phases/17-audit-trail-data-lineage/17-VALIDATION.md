---
phase: 17
slug: audit-trail-data-lineage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest (backend) |
| **Config file** | vitest.config.ts, backend/pytest.ini |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cd backend && python -m pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cd backend && python -m pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | AUDT-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | AUDT-04 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 2 | AUDT-02 | component | `npx vitest run` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 2 | AUDT-06 | component | `npx vitest run` | ❌ W0 | ⬜ pending |
| 17-02-03 | 02 | 2 | AUDT-03 | component | `npx vitest run` | ❌ W0 | ⬜ pending |
| 17-02-04 | 02 | 2 | AUDT-05 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/audit-timeline.test.tsx` — stubs for AUDT-02, AUDT-06 timeline rendering
- [ ] `tests/components/issue-traceability.test.tsx` — stubs for AUDT-03 before/after display
- [ ] `tests/lib/audit-logging.test.ts` — stubs for AUDT-01 action logging completeness
- [ ] `tests/components/rerun-validation.test.tsx` — stubs for AUDT-05 re-run from config

*Existing test infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline visual layout and icons | AUDT-02 | Visual/UX verification | Navigate to file detail > Audit Trail tab, verify timeline shows correct icons, colors, and chronological order |
| Re-run produces same results | AUDT-05 | End-to-end with real data | Upload a dataset, validate, then click "Re-run with this config" — verify identical issue counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
