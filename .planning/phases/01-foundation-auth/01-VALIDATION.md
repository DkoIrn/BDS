---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | none — Wave 0 installs |
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
| 1-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run tests/auth/signup.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | integration | `npx vitest run tests/auth/login.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-03 | integration | `npx vitest run tests/auth/logout.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-04 | integration | `npx vitest run tests/auth/reset.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | UIDE-01 | unit | `npx vitest run tests/ui/theme.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | UIDE-02 | manual-only | Manual browser testing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration for Next.js (with @vitejs/plugin-react)
- [ ] `tests/setup.ts` — Test setup with Supabase mocks
- [ ] `tests/auth/signup.test.ts` — stub for AUTH-01
- [ ] `tests/auth/login.test.ts` — stub for AUTH-02
- [ ] `tests/auth/logout.test.ts` — stub for AUTH-03
- [ ] `tests/auth/reset.test.ts` — stub for AUTH-04
- [ ] `tests/ui/theme.test.ts` — stub for UIDE-01
- [ ] Install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar collapses on tablet, layout responsive | UIDE-02 | Requires visual browser testing at breakpoints | 1. Open app at 1024px width 2. Verify sidebar collapses to icon mode 3. Verify layout doesn't break at 768px |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
