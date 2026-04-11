---
phase: 5
slug: validation-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (frontend) + pytest 8.x (backend — new) |
| **Config file** | vitest.config.ts (frontend); backend/pyproject.toml (backend — Wave 0 creates) |
| **Quick run command** | `cd backend && python -m pytest -x --tb=short` |
| **Full suite command** | `cd backend && python -m pytest && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest -x --tb=short`
- **After every plan wave:** Run `cd backend && python -m pytest && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | VALE-01 | unit | `cd backend && python -m pytest tests/validators/test_range_check.py -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 0 | VALE-02 | unit | `cd backend && python -m pytest tests/validators/test_missing_data.py -x` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 0 | VALE-03 | unit | `cd backend && python -m pytest tests/validators/test_duplicates.py -x` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 0 | VALE-04 | unit | `cd backend && python -m pytest tests/validators/test_outliers.py -x` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 0 | VALE-05 | unit | `cd backend && python -m pytest tests/validators/test_monotonicity.py -x` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 0 | VALE-07 | unit | `cd backend && python -m pytest tests/validators/test_explanations.py -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | VALE-01 | unit | `cd backend && python -m pytest tests/validators/test_range_check.py -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | VALE-02 | unit | `cd backend && python -m pytest tests/validators/test_missing_data.py -x` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | VALE-03 | unit | `cd backend && python -m pytest tests/validators/test_duplicates.py -x` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | VALE-04 | unit | `cd backend && python -m pytest tests/validators/test_outliers.py -x` | ❌ W0 | ⬜ pending |
| 05-02-05 | 02 | 1 | VALE-05 | unit | `cd backend && python -m pytest tests/validators/test_monotonicity.py -x` | ❌ W0 | ⬜ pending |
| 05-02-06 | 02 | 1 | VALE-07 | unit | `cd backend && python -m pytest tests/validators/test_explanations.py -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | VALE-01..07 | integration | `cd backend && python -m pytest tests/test_integration.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/pyproject.toml` — pytest configuration + dependencies
- [ ] `backend/tests/__init__.py` — test package init
- [ ] `backend/tests/conftest.py` — shared fixtures (sample DataFrames with survey data)
- [ ] `backend/tests/validators/__init__.py` — validator test package
- [ ] `backend/tests/validators/test_range_check.py` — stubs for VALE-01
- [ ] `backend/tests/validators/test_missing_data.py` — stubs for VALE-02
- [ ] `backend/tests/validators/test_duplicates.py` — stubs for VALE-03
- [ ] `backend/tests/validators/test_outliers.py` — stubs for VALE-04
- [ ] `backend/tests/validators/test_monotonicity.py` — stubs for VALE-05
- [ ] `backend/tests/validators/test_explanations.py` — stubs for VALE-07
- [ ] `backend/tests/test_integration.py` — integration test stubs
- [ ] pytest + pytest-cov install via pyproject.toml

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway deployment serves /health | Infra | Environment-specific | Deploy to Railway, hit /health endpoint |
| "Run QC" button triggers full pipeline | E2E | Requires browser + deployed backend | Click Run QC on file detail page, verify results appear |
| Supabase RLS blocks cross-user reads | Security | Requires two user sessions | Log in as user B, attempt to read user A's validation_runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
