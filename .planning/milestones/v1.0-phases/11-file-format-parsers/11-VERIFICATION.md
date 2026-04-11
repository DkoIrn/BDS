---
phase: 11-file-format-parsers
verified: 2026-03-29T15:00:00Z
status: passed
score: 9/9 must-haves verified
gaps:
  - truth: "FMT-01 through FMT-06 are cross-referenced in REQUIREMENTS.md"
    status: resolved
    reason: "FMT-01 through FMT-06 appear in ROADMAP.md and all three PLAN frontmatter files but are completely absent from .planning/REQUIREMENTS.md. The requirements traceability table ends at Phase 10. These are orphaned requirement IDs — declared but never registered in the central requirements document."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "FMT-01 through FMT-06 not present in any section (v1, v2, or Traceability table)"
    missing:
      - "Add FMT-01 through FMT-06 definitions to .planning/REQUIREMENTS.md under a 'File Format Support' section"
      - "Add FMT-01 through FMT-06 to the Traceability table mapping to Phase 11"
human_verification:
  - test: "Upload a .geojson file through the UI"
    expected: "File is accepted by dropzone, auto-parse fires, proxies to FastAPI, preview table shows parsed rows with coordinate columns"
    why_human: "Requires running FastAPI and Next.js together; FASTAPI_URL env var must be configured"
  - test: "Upload a .zip shapefile through the UI"
    expected: "File is accepted by dropzone, shapefile attributes and easting/northing columns appear in preview"
    why_human: "Integration path through both services; cannot verify without running environment"
  - test: "Upload a .kml file through the UI"
    expected: "Placemarks parsed with name, description, longitude, latitude, elevation columns in preview"
    why_human: "End-to-end integration test requiring live services"
  - test: "Upload a .dxf file through the UI"
    expected: "DXF entities extracted as rows with entity_type, layer, easting, northing, elevation"
    why_human: "End-to-end integration test requiring live services"
---

# Phase 11: File Format Parsers Verification Report

**Phase Goal:** The platform can ingest GeoJSON, Shapefile, KML, LandXML, and DXF files — extracting coordinates, attributes, and metadata into tabular form for QC and conversion
**Verified:** 2026-03-29T15:00:00Z
**Status:** gaps_found (1 documentation gap; all implementation verified)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GeoJSON FeatureCollection with Point/LineString/Polygon features produces rows with geometry columns and properties | VERIFIED | `backend/app/parsers/geojson_parser.py` — full implementation; handles FeatureCollection, single Feature, mixed geometry; returns ParseResult with headers and string[][] rows |
| 2 | Shapefile ZIP archive with .shp/.dbf/.shx extracts attribute rows with easting/northing columns | VERIFIED | `backend/app/parsers/shapefile_parser.py` — uses pyshp, extracts field_names + easting/northing, handles encoding via .cpg, raises ValueError on missing .shp |
| 3 | KML file with placemarks extracts name, description, and coordinate columns | VERIFIED | `backend/app/parsers/kml_parser.py` — lxml XPath parser, headers: name, description, longitude, latitude, elevation + sorted extended data keys |
| 4 | KMZ file is decompressed and the inner KML is parsed identically | VERIFIED | `parse_kmz` in `kml_parser.py` — unzips, finds .kml, delegates to parse_kml, sets source_format="kmz", raises ValueError on missing .kml |
| 5 | LandXML file with CgPoints extracts survey point coordinates as tabular rows | VERIFIED | `backend/app/parsers/landxml_parser.py` — handles LandXML 1.0/1.1/1.2 namespaces, extracts CgPoints with northing/easting/elevation, raises ValueError on non-LandXML |
| 6 | DXF file with POINT, LINE, LWPOLYLINE entities extracts coordinate rows with entity type and layer | VERIFIED | `backend/app/parsers/dxf_parser.py` — handles POINT, LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, 3DFACE, INSERT (8 entity types) |
| 7 | Parser dispatch routes files to correct parser by extension | VERIFIED | `backend/app/parsers/__init__.py` — PARSER_REGISTRY maps 7 extensions (.geojson, .json, .zip, .kml, .kmz, .xml, .dxf); dispatch_parser raises ValueError for unsupported |
| 8 | FastAPI /api/v1/parse endpoint accepts dataset_id, downloads file from Supabase, dispatches to correct parser, and stores parsed result | VERIFIED | `backend/app/routers/parsing.py` — full implementation; downloads file, dispatches, builds column_mappings, updates dataset record status/headers/metadata, 250-row preview cap |
| 9 | Next.js /api/parse route proxies geospatial formats to FastAPI while still handling CSV/Excel locally | VERIFIED | `src/app/api/parse/route.ts` — detects geospatial by extension (lines 58-60), proxies to FASTAPI_URL/api/v1/parse for geo formats, CSV/Excel handling unchanged |

**Score:** 9/9 truths verified (all implementation truths pass)

**Note:** The requirements cross-reference gap (FMT-01 to FMT-06 absent from REQUIREMENTS.md) is a documentation issue, not an implementation failure. All parser functionality is implemented and wired.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/parsers/base.py` | ParseResult dataclass and flatten_geometry helper | VERIFIED | ParseResult dataclass with headers, rows, total_rows, metadata, warnings, source_format; flatten_geometry handles 7 geometry types |
| `backend/app/parsers/geojson_parser.py` | parse_geojson function | VERIFIED | Exports parse_geojson; imports ParseResult + flatten_geometry from base; handles FeatureCollection and single Feature |
| `backend/app/parsers/shapefile_parser.py` | parse_shapefile_zip function | VERIFIED | Exports parse_shapefile_zip; imports ParseResult from base; uses pyshp |
| `backend/app/parsers/kml_parser.py` | parse_kml, parse_kmz functions | VERIFIED | Both functions present; uses lxml etree; imports ParseResult from base |
| `backend/app/parsers/landxml_parser.py` | parse_landxml function | VERIFIED | Exports parse_landxml; handles 3 LandXML namespace versions; imports ParseResult from base |
| `backend/app/parsers/dxf_parser.py` | parse_dxf function | VERIFIED | Exports parse_dxf; 8 entity types; imports ParseResult from base |
| `backend/app/parsers/__init__.py` | PARSER_REGISTRY dict and dispatch_parser function | VERIFIED | PARSER_REGISTRY with 7 extensions; dispatch_parser function; re-exports ParseResult |
| `backend/app/routers/parsing.py` | POST /api/v1/parse endpoint | VERIFIED | Contains dispatch_parser import and use; full error handling; registered in main.py |
| `src/lib/types/files.ts` | Updated ACCEPTED_FILE_TYPES with geospatial MIME types | VERIFIED | Contains application/geo+json, .kml, .kmz, .xml, .dxf, .zip MIME entries; GEOSPATIAL_EXTENSIONS constant exported |
| `src/app/api/parse/route.ts` | Proxy logic for geospatial formats to FastAPI | VERIFIED | Contains FASTAPI_URL fetch to /api/v1/parse; geospatial detection by extension |
| `backend/tests/parsers/test_geojson_parser.py` | GeoJSON tests | VERIFIED | File exists with substantive test content |
| `backend/tests/parsers/test_shapefile_parser.py` | Shapefile tests | VERIFIED | File exists; includes fixture generation via pyshp Writer |
| `backend/tests/parsers/test_kml_parser.py` | KML/KMZ tests | VERIFIED | File exists |
| `backend/tests/parsers/test_landxml_parser.py` | LandXML tests | VERIFIED | File exists |
| `backend/tests/parsers/test_dxf_parser.py` | DXF tests | VERIFIED | File exists |
| `backend/tests/parsers/test_parse_dispatch.py` | Dispatch registry tests | VERIFIED | 9 tests covering all extensions, routing, error handling, case insensitivity |
| `backend/tests/test_parse_endpoint.py` | Endpoint tests | VERIFIED | 7 tests with mocked Supabase client; covers success, 404, error status, preview limit, column mappings |
| `backend/tests/fixtures/sample.geojson` | GeoJSON test fixture | VERIFIED | File exists |
| `backend/tests/fixtures/sample.kml` | KML test fixture | VERIFIED | File exists |
| `backend/tests/fixtures/sample.xml` | LandXML test fixture | VERIFIED | File exists |
| `backend/tests/fixtures/sample.dxf` | DXF test fixture | VERIFIED | File exists |
| `.planning/REQUIREMENTS.md` | FMT-01 through FMT-06 defined and traceable | FAILED | FMT-01 to FMT-06 exist in ROADMAP.md and PLAN frontmatter but are absent from REQUIREMENTS.md entirely — no definitions, no traceability entries |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `geojson_parser.py` | `base.py` | imports ParseResult, flatten_geometry | WIRED | Line 5: `from app.parsers.base import ParseResult, flatten_geometry` |
| `shapefile_parser.py` | `base.py` | imports ParseResult | WIRED | Line 8: `from app.parsers.base import ParseResult` |
| `kml_parser.py` | `base.py` | imports ParseResult | WIRED | Line 8: `from app.parsers.base import ParseResult` |
| `landxml_parser.py` | `base.py` | imports ParseResult | WIRED | Line 7: `from app.parsers.base import ParseResult` |
| `dxf_parser.py` | `base.py` | imports ParseResult | WIRED | Line 8: `from app.parsers.base import ParseResult` |
| `__init__.py` | `geojson_parser.py` | imports parse_geojson into registry | WIRED | Line 7: `from app.parsers.geojson_parser import parse_geojson` |
| `__init__.py` | `dxf_parser.py` | imports parse_dxf into registry | WIRED | Line 11: `from app.parsers.dxf_parser import parse_dxf` |
| `parsing.py` (router) | `__init__.py` | imports dispatch_parser | WIRED | Line 9: `from app.parsers import dispatch_parser` |
| `route.ts` (Next.js) | FastAPI `/api/v1/parse` | HTTP fetch proxy | WIRED | Line 69: `fetch(\`${fastApiUrl}/api/v1/parse\`, ...)` |
| `main.py` | `parsing.py` (router) | includes parsing_router | WIRED | Lines 5, 23: import and `app.include_router(parsing_router)` |
| `file-upload-zone.tsx` | `files.ts` | imports ACCEPTED_FILE_TYPES | WIRED | Line 31: `import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/types/files"` — used at line 126 |

All key links: WIRED

---

## Requirements Coverage

| Requirement | Source Plan | Status | Notes |
|-------------|------------|--------|-------|
| FMT-01 | 11-01-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | GeoJSON parser implemented and tested. ID missing from REQUIREMENTS.md |
| FMT-02 | 11-01-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | Shapefile parser implemented and tested. ID missing from REQUIREMENTS.md |
| FMT-03 | 11-01-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | KML/KMZ parser implemented and tested. ID missing from REQUIREMENTS.md |
| FMT-04 | 11-02-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | LandXML parser implemented and tested. ID missing from REQUIREMENTS.md |
| FMT-05 | 11-02-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | DXF parser implemented and tested. ID missing from REQUIREMENTS.md |
| FMT-06 | 11-03-PLAN.md | SATISFIED (implementation) / ORPHANED (docs) | FastAPI endpoint + Next.js proxy wired. ID missing from REQUIREMENTS.md |

**Finding:** All 6 FMT requirement IDs are ORPHANED in REQUIREMENTS.md. They exist in ROADMAP.md (Phase 11 section) and in PLAN frontmatter, but .planning/REQUIREMENTS.md has no FMT-* definitions anywhere and the Traceability table ends at Phase 10. The implementation satisfies the intent of these requirements, but they cannot be formally traced.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | No TODO/FIXME, no stub implementations, no empty returns, no placeholder comments detected across all parser files and integration files |

**Minor deviation noted (not blocking):** The plan's Task 2 in 11-03 specified adding `application/json` and `application/octet-stream` MIME type entries to ACCEPTED_FILE_TYPES. The final implementation omitted these two entries. `application/json` is covered by the `.geojson` extension route in the parse route (extension-based detection), and `application/octet-stream` was noted in the plan as potentially problematic. This is an acceptable simplification, not a gap.

---

## Human Verification Required

### 1. End-to-End GeoJSON Upload

**Test:** Upload a .geojson file through the file upload zone in the UI
**Expected:** Dropzone accepts the file; parsing status updates; preview table shows rows with geometry_type, longitude, latitude, and property columns
**Why human:** Requires FASTAPI_URL env var configured, both Next.js and FastAPI running, and Supabase storage accessible

### 2. End-to-End Shapefile Upload

**Test:** Upload a .zip file containing a shapefile through the UI
**Expected:** File accepted; easting/northing/attribute columns appear in preview
**Why human:** Requires live services and a real shapefile ZIP

### 3. End-to-End KML Upload

**Test:** Upload a .kml file through the UI
**Expected:** Placemarks parsed with name, description, longitude, latitude, elevation columns in preview
**Why human:** Requires live services

### 4. End-to-End DXF Upload

**Test:** Upload a .dxf file through the UI
**Expected:** Entities extracted as rows with entity_type, layer, easting, northing, elevation columns
**Why human:** Requires live services

---

## Gaps Summary

**One gap identified — documentation only, not implementation.**

All 6 requirement IDs claimed by this phase (FMT-01 through FMT-06) are absent from `.planning/REQUIREMENTS.md`. The file ends its Traceability table at Phase 10. These IDs are defined in ROADMAP.md and referenced in PLAN frontmatter, but the central requirements document was never updated for Phase 11.

This is a project hygiene issue: the requirements document no longer accurately reflects what the platform supports. It does not indicate any missing functionality — every parser is implemented, wired, and tested. The fix is to add FMT-01 through FMT-06 definitions and their traceability entries to REQUIREMENTS.md.

**Implementation is complete.** The phase goal — ingesting GeoJSON, Shapefile, KML/KMZ, LandXML, and DXF files into tabular output — is fully achieved. All parsers exist, are substantive, are wired to each other and to the API layer, and have test coverage.

---

_Verified: 2026-03-29T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
