---
phase: 8
slug: results-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-00-01 | 00 | 0 | ALL | scaffold | `npx vitest run tests/components/issues-table.test.tsx tests/components/results-stat-cards.test.tsx tests/components/issue-row-detail.test.tsx tests/components/run-switcher.test.tsx --reporter=verbose` | Creates them | pending |
| 8-01-01 | 01 | 1 | DASH-01, DASH-02 | unit | `npx tsc --noEmit && npx vitest run tests/components/results-stat-cards.test.tsx tests/components/run-switcher.test.tsx --reporter=verbose` | Yes (W0) | pending |
| 8-01-02 | 01 | 1 | DASH-01, DASH-02, DASH-03, PROJ-05 | unit | `npx tsc --noEmit && npx vitest run tests/components/issues-table.test.tsx tests/components/results-stat-cards.test.tsx tests/components/issue-row-detail.test.tsx tests/components/run-switcher.test.tsx --reporter=verbose` | Yes (W0) | pending |
| 8-02-01 | 02 | 2 | DASH-01 | compile | `npx tsc --noEmit` | N/A | pending |
| 8-02-02 | 02 | 2 | DASH-01, PROJ-05 | full | `npx tsc --noEmit && npx vitest run --reporter=verbose` | Yes (W0) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Plan 08-00-PLAN.md creates all 4 test stub files before implementation begins:

- [ ] `tests/components/issues-table.test.tsx` — stubs for DASH-01 severity filtering and sorting
- [ ] `tests/components/results-stat-cards.test.tsx` — stubs for DASH-02 stat card rendering and color thresholds
- [ ] `tests/components/issue-row-detail.test.tsx` — stubs for DASH-03 expanded detail display
- [ ] `tests/components/run-switcher.test.tsx` — stubs for PROJ-05 run selection behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab auto-switch to Results after validation | DASH-01 | Requires real-time SSE event + UI interaction | 1. Upload file 2. Run validation 3. Verify tab switches to Results |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (08-00-PLAN.md)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
