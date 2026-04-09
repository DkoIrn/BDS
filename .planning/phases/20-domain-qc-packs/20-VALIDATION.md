---
phase: 20
slug: domain-qc-packs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend validators) + manual browser testing (frontend) |
| **Config file** | backend/pytest.ini or pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/test_kp_drift.py tests/test_segment_continuity.py -x -v` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -v` |
| **Estimated runtime** | ~15 seconds (backend tests) + ~3 minutes (manual frontend) |

---

## Sampling Rate

- **After every task commit:** Run quick test command for backend, manual test for frontend
- **After every plan wave:** Full backend test suite + manual pipeline walkthrough
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | New validators | unit/pytest | `cd backend && python -m pytest tests/test_kp_drift.py tests/test_segment_continuity.py -x -v` | N/A | ⬜ pending |
| 20-01-02 | 01 | 1 | Schema extension | unit/pytest | `cd backend && python -m pytest tests/ -x -v` | N/A | ⬜ pending |
| 20-02-01 | 02 | 2 | Pack definitions (backend+frontend) | manual | Verify 4 packs in profile dropdown | N/A | ⬜ pending |
| 20-02-02 | 02 | 2 | Profile selector UI | manual | Verify pack descriptions + column pills in dropdown | N/A | ⬜ pending |
| 20-02-03 | 02 | 2 | Chain checks in threshold editor | manual | Verify new Chain Checks group with toggles + sliders | N/A | ⬜ pending |
| 20-02-04 | 02 | 2 | Auto-suggestion banner | manual | Map columns, verify suggestion banner appears | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. pytest already configured for backend.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pack dropdown shows 4 packs with descriptions | Pack definitions | UI visual | Open profile selector, verify 3 domain packs + General with inline descriptions and column pills |
| Chain Checks group in threshold editor | UI extension | Visual layout | Select a pack, click Customize, verify Chain Checks section with KP drift + segment continuity toggles and sliders |
| Auto-suggestion banner | Pipeline UX | End-to-end flow | Upload CSV with KP+DOB+depth columns, complete Inspect, verify suggestion banner at Validate stage |
| Pack severity variation | Chain check behavior | Requires validation run | Run As-Laid pack on test data with KP drift, verify KP drift flagged as CRITICAL |
| Template sync | Backend/frontend parity | Cross-system | Verify profile selector shows same packs as backend templates endpoint |

---

## Validation Sign-Off

- [ ] All tasks have verify instructions
- [ ] Sampling continuity: test per task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
