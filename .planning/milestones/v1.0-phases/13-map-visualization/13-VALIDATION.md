---
phase: 13
slug: map-visualization
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/visualize/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/visualize/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-00 | 01 | 0 | Test stubs + fixtures | scaffold | `npx vitest run tests/visualize/measurement.test.ts --reporter=verbose` | Created in Task 0 | ⬜ pending |
| 13-01-01 | 01 | 1 | Parse GeoJSON | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "geojson"` | Created in Task 0 | ⬜ pending |
| 13-01-02 | 01 | 1 | Parse KML | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kml"` | Created in Task 0 | ⬜ pending |
| 13-01-03 | 01 | 1 | Parse KMZ | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kmz"` | Created in Task 0 | ⬜ pending |
| 13-01-04 | 01 | 1 | Parse Shapefile | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "shapefile"` | Created in Task 0 | ⬜ pending |
| 13-01-05 | 01 | 1 | Unsupported format error | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "unsupported"` | Created in Task 0 | ⬜ pending |
| 13-01-06 | 01 | 1 | Layer color assignment | unit | `npx vitest run tests/visualize/layer-colors.test.ts` | Created in Task 0 | ⬜ pending |
| 13-01-07 | 01 | 1 | Session store | unit | `npx vitest run tests/visualize/session-store.test.ts` | Created in Task 0 | ⬜ pending |
| 13-01-08 | 01 | 1 | Distance measurement | unit | `npx vitest run tests/visualize/measurement.test.ts` | Created in Task 0 | ⬜ pending |
| 13-01-09 | 01 | 1 | Map + route compiles | type-check | `npx tsc --noEmit --skipLibCheck` | N/A | ⬜ pending |
| 13-02-01 | 02 | 2 | New components compile | type-check | `npx tsc --noEmit --skipLibCheck` | N/A | ⬜ pending |
| 13-02-02 | 02 | 2 | Map renders | manual-only | Manual: load `/tools/visualize` in browser | N/A | ⬜ pending |
| 13-02-03 | 02 | 2 | Layer toggle | manual-only | Manual: upload file, toggle layer | N/A | ⬜ pending |
| 13-02-04 | 02 | 2 | Screenshot export | manual-only | Manual: click screenshot button | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/visualize/parse-spatial-file.test.ts` — stubs for GeoJSON, KML, KMZ, Shapefile parsing (Task 0 in plan 13-01)
- [x] `tests/visualize/layer-colors.test.ts` — color assignment cycle tests (Task 0 in plan 13-01)
- [x] `tests/visualize/session-store.test.ts` — session persistence tests (Task 0 in plan 13-01)
- [x] `tests/visualize/measurement.test.ts` — distance calculation tests (Task 0 in plan 13-01)
- [x] `tests/fixtures/sample.geojson` — sample GeoJSON fixture (Task 0 in plan 13-01)
- [x] `tests/fixtures/sample.kml` — sample KML fixture (Task 0 in plan 13-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map renders without SSR errors | Map display | Leaflet requires real browser DOM | Load `/tools/visualize`, verify map tiles render |
| Layer toggle hides/shows features | Layer controls | Visual verification needed | Upload file, toggle layer checkbox, verify features appear/disappear |
| Screenshot exports PNG | Export | Canvas rendering requires real browser | Click screenshot button, verify PNG downloads with map content |
| Hover tooltip shows feature info | Interaction | Mouse event simulation insufficient | Hover over a feature, verify tooltip with name/label appears |
| Click popup shows all attributes | Interaction | DOM popup requires visual check | Click a feature, verify popup with all attributes from source |
| Base map switcher works | Map display | Tile loading requires real network | Switch between OSM/satellite/topo, verify tiles change |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
