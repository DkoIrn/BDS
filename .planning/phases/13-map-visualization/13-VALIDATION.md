---
phase: 13
slug: map-visualization
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 13-01-01 | 01 | 0 | Parse GeoJSON | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "geojson"` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 0 | Parse KML | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kml"` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 0 | Parse KMZ | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "kmz"` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 0 | Parse Shapefile | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "shapefile"` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 0 | Unsupported format error | unit | `npx vitest run tests/visualize/parse-spatial-file.test.ts -t "unsupported"` | ❌ W0 | ⬜ pending |
| 13-01-06 | 01 | 0 | Layer color assignment | unit | `npx vitest run tests/visualize/layer-colors.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-07 | 01 | 0 | Session store | unit | `npx vitest run tests/visualize/session-store.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-08 | 01 | 0 | Distance measurement | unit | `npx vitest run tests/visualize/measurement.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | Map renders | manual-only | Manual: load `/tools/visualize` in browser | N/A | ⬜ pending |
| 13-02-02 | 02 | 1 | Layer toggle | manual-only | Manual: upload file, toggle layer | N/A | ⬜ pending |
| 13-02-03 | 02 | 1 | Screenshot export | manual-only | Manual: click screenshot button | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/visualize/parse-spatial-file.test.ts` — stubs for GeoJSON, KML, KMZ, Shapefile parsing
- [ ] `tests/visualize/layer-colors.test.ts` — color assignment cycle tests
- [ ] `tests/visualize/session-store.test.ts` — session persistence tests
- [ ] `tests/visualize/measurement.test.ts` — distance calculation tests
- [ ] `tests/fixtures/sample.geojson` — sample GeoJSON fixture
- [ ] `tests/fixtures/sample.kml` — sample KML fixture

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
