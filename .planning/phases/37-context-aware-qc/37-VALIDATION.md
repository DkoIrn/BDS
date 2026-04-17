---
phase: 37
slug: context-aware-qc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest (backend) |
| **Config file** | vitest.config.ts, backend/pytest.ini |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && cd backend && python -m pytest tests/ -x` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | CTXQ-01, CTXQ-02 | unit | `cd backend && python -m pytest tests/test_context_zones.py -x -v` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | CTXQ-03 | unit | `cd backend && python -m pytest tests/test_context_zones.py -x -v` | ❌ W0 | ⬜ pending |
| 37-02-01 | 02 | 1 | CTXQ-01 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 37-03-01 | 03 | 2 | CTXQ-04 | integration | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_context_zones.py` — zone execution and event matching tests
- [ ] Existing test infrastructure covers framework installation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zone configuration UI | CTXQ-01 | Interactive UI | Create zones via UI, verify KP range inputs and modifier sliders |
| Event-conditional rules | CTXQ-03 | Complex interaction | Configure event rule, verify threshold relaxation in results |
| Domain preset loading | CTXQ-04 | Visual verification | Select domain pack, verify presets appear with correct defaults |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
