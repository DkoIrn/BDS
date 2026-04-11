---
phase: 29
slug: job-queue-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | backend/pytest.ini, vitest.config.ts |
| **Quick run command** | `cd backend && python -m pytest tests/test_job_queue.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_job_queue.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | JOBQ-01 | unit | `pytest tests/test_job_queue.py::test_job_persisted` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | JOBQ-02 | unit | `pytest tests/test_job_queue.py::test_retry_backoff` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | JOBQ-05 | unit | `pytest tests/test_job_queue.py::test_idempotent_retry` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 2 | JOBQ-03 | manual | Browser: progress updates during validation | N/A | ⬜ pending |
| 29-02-02 | 02 | 2 | JOBQ-04 | manual | Browser: error state after 3 failures | N/A | ⬜ pending |
| 29-02-03 | 02 | 2 | JOBQ-06 | manual | Browser: job history on dashboard + dataset detail | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_job_queue.py` — stubs for JOBQ-01, JOBQ-02, JOBQ-05
- [ ] `backend/tests/conftest.py` — shared fixtures (if needed for procrastinate test setup)

*Existing pytest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress bar updates in real-time | JOBQ-03 | Requires Supabase Realtime + browser | Run validation, watch progress bar update |
| Error state with retry button | JOBQ-04 | UI interaction + multiple failure states | Force validation failure, verify error display and retry |
| Job history auto-refresh | JOBQ-06 | Real-time UI update | Start validation, watch dashboard Recent Jobs section update |
| Cancel running job | JOBQ-03 | Worker cancellation + UI | Start validation, click Cancel, verify job stops |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
