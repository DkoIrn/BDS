---
phase: 7
slug: async-processing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | Vitest 4.x + jsdom + @testing-library/react |
| **Framework (backend)** | pytest |
| **Config file (frontend)** | vitest.config.ts |
| **Config file (backend)** | backend/pyproject.toml |
| **Quick run command (frontend)** | `npx vitest run --reporter=verbose` |
| **Quick run command (backend)** | `cd backend && python -m pytest -x` |
| **Full suite command** | `npx vitest run && cd backend && python -m pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (frontend) or `cd backend && python -m pytest -x` (backend)
- **After every plan wave:** Run `npx vitest run && cd backend && python -m pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PROC-01 | unit | `cd backend && python -m pytest tests/test_async_validate.py -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | PROC-01 | unit | `npx vitest run src/app/api/validate/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | PROC-02 | unit | `npx vitest run src/components/realtime-provider.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | PROC-02 | unit | `npx vitest run src/components/files/file-list.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_async_validate.py` — stubs for PROC-01 (FastAPI background task behavior)
- [ ] `src/app/api/validate/route.test.ts` — stubs for PROC-01 (Next.js 202 response)
- [ ] `src/components/realtime-provider.test.ts` — stubs for PROC-02 (toast on status change)
- [ ] `src/components/files/file-list.test.ts` — stubs for PROC-02 (animated StatusBadge)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| User can navigate freely during processing | PROC-01 | Requires full browser interaction | Upload file, immediately navigate to another page, verify no blocking |
| Toast action link navigates to results | PROC-02 | Requires toast click + navigation | Upload file, wait for completion toast, click "View Results", verify navigation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
