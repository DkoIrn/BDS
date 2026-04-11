---
phase: 11
slug: file-format-parsers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) |
| **Config file** | backend/pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/test_parsers.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_parsers.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | GeoJSON parse | unit | `pytest tests/test_parsers.py::test_geojson` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | Shapefile parse | unit | `pytest tests/test_parsers.py::test_shapefile` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | KML parse | unit | `pytest tests/test_parsers.py::test_kml` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | LandXML parse | unit | `pytest tests/test_parsers.py::test_landxml` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 1 | DXF parse | unit | `pytest tests/test_parsers.py::test_dxf` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | FastAPI endpoint | integration | `pytest tests/test_parsers.py::test_parse_endpoint` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | Next.js proxy | integration | Browser test | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_parsers.py` — stubs for all 5 format parsers
- [ ] `backend/tests/fixtures/` — sample files for each format (GeoJSON, SHP zip, KML, LandXML, DXF)

*Existing pytest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File upload → parse flow | End-to-end | Requires browser + Supabase | Upload .geojson file, verify preview shows rows |
| ZIP extraction for SHP | Archive handling | Requires real file upload | Upload .zip with .shp/.dbf/.shx, verify parse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
