---
phase: 3
slug: file-upload-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x + jsdom |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

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
| 3-01-01 | 01 | 1 | FILE-01 | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "accepts"` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | FILE-01 | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "rejects large"` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | FILE-01 | unit | `npx vitest run tests/components/file-upload-zone.test.tsx -t "upload flow"` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | FILE-06 | unit | `npx vitest run tests/actions/files.test.ts -t "ownership"` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | FILE-06 | unit | `npx vitest run tests/actions/files.test.ts -t "delete"` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | FILE-06 | unit | `npx vitest run tests/actions/files.test.ts -t "signed url"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/file-upload-zone.test.tsx` — stubs for FILE-01 upload UI
- [ ] `tests/actions/files.test.ts` — stubs for FILE-06 server actions
- [ ] Supabase client mock setup for storage operations

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop visual feedback | FILE-01 | Visual interaction | 1. Drag file over zone 2. Verify highlight state 3. Drop file 4. Verify upload starts |
| Upload progress indicator | FILE-01 | Runtime behavior | 1. Upload large file 2. Verify progress bar animates 3. Verify completion state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
