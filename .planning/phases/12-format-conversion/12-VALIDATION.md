---
phase: 12
slug: format-conversion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 8.0 |
| **Config file** | backend/tests/conftest.py (existing fixtures) |
| **Quick run command** | `cd backend && python -m pytest tests/writers/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/writers/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CONV-01 | integration | `cd backend && python -m pytest tests/test_conversion_endpoint.py::test_convert_csv_to_geojson -x` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | CONV-02 | unit | `cd backend && python -m pytest tests/writers/test_writers.py -x` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | CONV-03 | integration | `cd backend && python -m pytest tests/test_conversion_endpoint.py -x` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | CONV-04 | unit | `cd backend && python -m pytest tests/test_conversion_endpoint.py::test_convert_invalid_format -x` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | CONV-05 | unit | `cd backend && python -m pytest tests/writers/test_geojson_writer.py::test_partial_rows -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/writers/__init__.py` — new test package
- [ ] `backend/tests/writers/test_csv_writer.py` — CSV writer unit tests
- [ ] `backend/tests/writers/test_geojson_writer.py` — GeoJSON writer unit tests
- [ ] `backend/tests/writers/test_kml_writer.py` — KML writer unit tests
- [ ] `backend/tests/test_conversion_endpoint.py` — integration tests for FastAPI endpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File download triggers browser save dialog | CONV-03 | Browser behavior | Upload a file, convert, verify download prompt appears |
| UI displays conversion warnings | CONV-05 | Visual verification | Convert file with projected coords, check warning banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
