---
phase: 14
slug: data-transform-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 8.0 |
| **Config file** | backend/pyproject.toml [tool.pytest.ini_options] |
| **Quick run command** | `cd backend && python -m pytest tests/transforms/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/transforms/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | XFRM-01 | unit | `cd backend && python -m pytest tests/transforms/test_crs.py -x` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 0 | XFRM-02 | unit | `cd backend && python -m pytest tests/transforms/test_detect_crs.py -x` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 0 | XFRM-03 | unit | `cd backend && python -m pytest tests/transforms/test_merge.py -x` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 0 | XFRM-04 | unit | `cd backend && python -m pytest tests/transforms/test_split.py::test_split_by_kp -x` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 0 | XFRM-05 | unit | `cd backend && python -m pytest tests/transforms/test_split.py::test_split_by_column -x` | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 0 | XFRM-06 | unit | `cd backend && python -m pytest tests/test_transform_endpoint.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/transforms/__init__.py` — package init
- [ ] `backend/tests/transforms/test_crs.py` — CRS conversion tests (XFRM-01)
- [ ] `backend/tests/transforms/test_detect_crs.py` — CRS detection heuristic tests (XFRM-02)
- [ ] `backend/tests/transforms/test_merge.py` — merge logic tests (XFRM-03)
- [ ] `backend/tests/transforms/test_split.py` — split by KP and column value tests (XFRM-04, XFRM-05)
- [ ] `backend/tests/test_transform_endpoint.py` — endpoint integration tests (XFRM-06)
- [ ] `backend/app/transforms/__init__.py` — transforms package
- [ ] pyproj dependency: `pip install pyproj>=3.7`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-file drag-and-drop upload | Merge UI | Browser drag event simulation unreliable | 1. Open /tools/transform/merge 2. Drag 2+ files onto dropzone 3. Verify file list shows all files |
| ZIP download contains correct split files | Split download | File download triggers require browser context | 1. Split a file by column value 2. Click "Download all as ZIP" 3. Extract ZIP, verify file count matches unique values |
| CRS auto-detect warning appears | CRS UI | Visual toast/alert testing | 1. Upload file with ambiguous coordinates 2. Verify warning appears with manual CRS selection prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
