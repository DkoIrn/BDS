---
phase: 36
slug: custom-rule-builder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 36 — Validation Strategy

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
| 36-01-01 | 01 | 1 | RULE-01, RULE-02 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 36-01-02 | 01 | 1 | RULE-03 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 36-02-01 | 02 | 2 | RULE-04 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 2 | RULE-05 | integration | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/custom-rules/` — test directory structure
- [ ] `backend/tests/test_custom_rules.py` — backend rule execution tests

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual IF/THEN builder UX | RULE-01 | Complex interactive UI | Create rule with 3 conditions, verify layout and interactions |
| Rule preview matches actual | RULE-03 | Requires visual inspection | Test rule against dataset, verify highlighted rows match |
| AND/OR nesting depth limit | RULE-02 | UI interaction | Try to nest beyond 2 levels, verify button disabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
