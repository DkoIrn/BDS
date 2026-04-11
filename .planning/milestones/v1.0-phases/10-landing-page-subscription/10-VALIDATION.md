---
phase: 10
slug: landing-page-subscription
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/components/landing --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/components/landing --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | UIDE-03 | unit | `npx vitest run tests/components/landing-page.test.tsx -x` | No - W0 | pending |
| 10-01-02 | 01 | 1 | SUBS-01 | unit | `npx vitest run tests/components/pricing-section.test.tsx -x` | No - W0 | pending |
| 10-01-03 | 01 | 1 | SUBS-02 | unit | `npx vitest run tests/components/pricing-section.test.tsx -x` | No - W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/landing-page.test.tsx` — covers UIDE-03 (renders all sections)
- [ ] `tests/components/pricing-section.test.tsx` — covers SUBS-01, SUBS-02 (tier names, features, prices)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smooth scroll anchor navigation | UIDE-03 | CSS scroll-behavior not testable in jsdom | Click each nav link, verify section scrolls into view |
| Mobile responsive layout | UIDE-03 | Visual layout requires real viewport | Resize browser to 375px, verify cards stack vertically |
| Auth redirect for logged-in users | UIDE-03 | Requires real Supabase session | Log in, visit /, verify redirect to /dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
