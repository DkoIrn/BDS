---
phase: 16
slug: pipeline-workflow
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-31
updated: 2026-03-29
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x with jsdom |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/pipeline/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/pipeline/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-00-01 | 00 | 0 | PIPE-01..07 | stub | `npx vitest run tests/pipeline/ --reporter=verbose` | Created in W0 | pending |
| 16-01-01 | 01 | 1 | PIPE-01 | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | W0 stub | pending |
| 16-01-02 | 01 | 1 | PIPE-02 | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | W0 stub | pending |
| 16-01-03 | 01 | 1 | PIPE-03 | unit | `npx vitest run tests/pipeline/pipeline-store.test.ts -x` | W0 stub | pending |
| 16-01-04 | 01 | 1 | PIPE-04 | unit | `npx vitest run tests/pipeline/pipeline-stepper.test.ts -x` | W0 stub | pending |
| 16-02-01 | 02 | 2 | PIPE-05 | component | `npx vitest run tests/pipeline/stage-dispatch.test.ts -x` | W0 stub | pending |
| 16-02-02 | 02 | 2 | PIPE-07 | unit | `npx vitest run tests/pipeline/pipeline-store.test.ts -x` | W0 stub (round-trip test) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/pipeline/pipeline-state.test.ts` -- stubs for PIPE-01, PIPE-02 (reducer + gating logic)
- [ ] `tests/pipeline/pipeline-store.test.ts` -- stubs for PIPE-03, PIPE-07 (sessionStorage persistence + round-trip)
- [ ] `tests/pipeline/pipeline-stepper.test.ts` -- stubs for PIPE-04 (stepper rendering)
- [ ] `tests/pipeline/stage-dispatch.test.ts` -- stubs for PIPE-05 (stage panel dispatch assertions)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop visual feedback (border color change) | PIPE-05 | CSS visual state not testable in jsdom | Drop a CSV file onto the import area, verify border highlights |
| Stepper transitions feel smooth and professional | PIPE-06 | Visual/animation quality judgment | Click through all 5 stages, verify transitions are smooth |

Note: PIPE-07 (sessionStorage round-trip) was reclassified from manual-only to unit-testable. The `pipeline-store.ts` save/load/clear functions are pure logic operating on the sessionStorage API, which jsdom provides. The round-trip test verifies `savePipelineState` then `loadPipelineState` returns equivalent serializable state.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
