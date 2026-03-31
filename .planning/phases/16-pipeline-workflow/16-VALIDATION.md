---
phase: 16
slug: pipeline-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
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
| 16-01-01 | 01 | 1 | PIPE-01 | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | PIPE-02 | unit | `npx vitest run tests/pipeline/pipeline-state.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | PIPE-03 | unit | `npx vitest run tests/pipeline/pipeline-store.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | PIPE-04 | unit | `npx vitest run tests/pipeline/pipeline-stepper.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pipeline/pipeline-state.test.ts` — stubs for PIPE-01, PIPE-02 (reducer + gating logic)
- [ ] `tests/pipeline/pipeline-store.test.ts` — stubs for PIPE-03 (sessionStorage persistence)
- [ ] `tests/pipeline/pipeline-stepper.test.ts` — stubs for PIPE-04 (stepper rendering)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop upload works in Import stage | PIPE-05 | Browser drag event not simulatable in jsdom | Drop a CSV file onto the import area, verify it loads |
| Stepper transitions feel smooth | PIPE-06 | Visual/animation quality | Click through all 5 stages, verify transitions are smooth |
| Pipeline state survives page refresh | PIPE-07 | Full browser session behavior | Start pipeline, refresh page, verify state restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
