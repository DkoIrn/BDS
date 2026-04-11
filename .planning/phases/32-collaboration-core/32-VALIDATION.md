---
phase: 32
slug: collaboration-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/collaboration --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/collaboration --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 0 | COLB-01 | unit | `npx vitest run tests/collaboration/notification-bell.test.tsx` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 0 | COLB-01 | unit | `npx vitest run tests/collaboration/notification-actions.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 0 | COLB-03 | unit | `npx vitest run tests/collaboration/comment-resolution.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 0 | COLB-03 | unit | `npx vitest run tests/collaboration/comment-resolution-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 32-01-05 | 01 | 0 | COLB-04 | unit | `npx vitest run tests/collaboration/mention-parser.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-06 | 01 | 0 | COLB-04 | unit | `npx vitest run tests/collaboration/mention-trigger.test.ts` | ❌ W0 | ⬜ pending |
| 32-01-07 | 01 | 0 | COLB-04 | unit | `npx vitest run tests/collaboration/mention-input.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/collaboration/` directory — new test directory for this phase
- [ ] `tests/collaboration/notification-bell.test.tsx` — stubs for COLB-01 UI (unread count, mark-read)
- [ ] `tests/collaboration/notification-actions.test.ts` — stubs for COLB-01 server actions
- [ ] `tests/collaboration/comment-resolution.test.ts` — stubs for COLB-03 logic (resolve/reopen)
- [ ] `tests/collaboration/comment-resolution-ui.test.tsx` — stubs for COLB-03 UI (filter toggle)
- [ ] `tests/collaboration/mention-parser.test.ts` — stubs for COLB-04 parsing
- [ ] `tests/collaboration/mention-trigger.test.ts` — stubs for COLB-04 cursor detection
- [ ] `tests/collaboration/mention-input.test.ts` — stubs for COLB-04 insertion

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Realtime notification delivery | COLB-01 | Requires live Supabase Realtime subscription | 1. Open two browser tabs as different org users. 2. User A triggers validation. 3. User A sees toast + bell count increment. |
| @mention autocomplete UX | COLB-04 | Visual positioning and keyboard navigation | 1. Type @ in comment box. 2. Verify dropdown appears below textarea. 3. Type letters to filter. 4. Arrow keys + Enter to select. |
| Comment collapse/expand | COLB-03 | Visual layout state | 1. Resolve a comment. 2. Verify it collapses to one-line summary. 3. Click to expand. 4. Click Reopen. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
