---
phase: 12-format-conversion
plan: 01
subsystem: api
tags: [fastapi, csv, geojson, kml, format-conversion, writers, parsers]

requires:
  - phase: 11-file-format-parsers
    provides: ParseResult dataclass and dispatch_parser registry for geospatial formats

provides:
  - CSV/GeoJSON/KML writer functions converting ParseResult to output bytes
  - POST /api/v1/convert endpoint for file format conversion
  - CSV and Excel parser registration in dispatch_parser
  - Shared coordinate column detection helper

affects: [12-format-conversion, 13-map-visualization, 14-data-transform-tools]

tech-stack:
  added: [python-multipart]
  patterns: [writer pure functions returning (bytes, warnings) tuple, WRITERS dict registry pattern]

key-files:
  created:
    - backend/app/writers/__init__.py
    - backend/app/writers/_coords.py
    - backend/app/writers/csv_writer.py
    - backend/app/writers/geojson_writer.py
    - backend/app/writers/kml_writer.py
    - backend/app/parsers/tabular_parser.py
    - backend/app/routers/conversion.py
    - backend/tests/writers/test_csv_writer.py
    - backend/tests/writers/test_geojson_writer.py
    - backend/tests/writers/test_kml_writer.py
    - backend/tests/test_conversion_endpoint.py
  modified:
    - backend/app/parsers/__init__.py
    - backend/app/main.py
    - backend/requirements.txt

key-decisions:
  - "Shared _coords.py helper for coordinate column detection across GeoJSON and KML writers"
  - "CSV/Excel parsers use stdlib csv.reader and openpyxl (not pandas) for lightweight parsing"
  - "Writer functions return (bytes, warnings) tuple for consistent partial conversion handling"

patterns-established:
  - "Writer pattern: pure function (ParseResult) -> tuple[bytes, list[str]] with no side effects"
  - "WRITERS registry dict mapping format string to (writer_fn, media_type, extension) tuple"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04, CONV-05]

duration: 5min
completed: 2026-03-29
---

# Phase 12 Plan 01: Format Conversion Backend Summary

**CSV/GeoJSON/KML writer functions with POST /api/v1/convert endpoint, coordinate column detection, and CSV/Excel parser registration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T17:24:43Z
- **Completed:** 2026-03-29T17:29:28Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Three writer functions (CSV, GeoJSON, KML) converting ParseResult to output bytes with partial conversion warnings
- POST /api/v1/convert endpoint accepting file upload + target_format, returning streaming download with correct headers
- CSV and Excel parsers registered in dispatch_parser, making the conversion endpoint fully self-contained
- 23 tests total (16 unit + 7 integration) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Writer module with CSV, GeoJSON, KML writers and CSV/Excel parser registration** - `56b2bba` (feat)
2. **Task 2: FastAPI /api/v1/convert endpoint with integration tests** - `ad70e16` (feat)

## Files Created/Modified
- `backend/app/writers/__init__.py` - Writer package exports
- `backend/app/writers/_coords.py` - Shared coordinate column detection (LON/LAT/ELEV name sets)
- `backend/app/writers/csv_writer.py` - ParseResult to CSV bytes via csv.writer
- `backend/app/writers/geojson_writer.py` - ParseResult to GeoJSON FeatureCollection with Point geometries
- `backend/app/writers/kml_writer.py` - ParseResult to KML with Placemarks, ExtendedData, CRS warning
- `backend/app/parsers/tabular_parser.py` - CSV (csv.reader) and Excel (openpyxl) parsers
- `backend/app/parsers/__init__.py` - Added .csv/.xlsx/.xls to PARSER_REGISTRY
- `backend/app/routers/conversion.py` - POST /api/v1/convert endpoint with StreamingResponse
- `backend/app/main.py` - Registered conversion_router
- `backend/requirements.txt` - Added python-multipart dependency
- `backend/tests/writers/test_csv_writer.py` - 3 CSV writer tests
- `backend/tests/writers/test_geojson_writer.py` - 7 GeoJSON writer tests
- `backend/tests/writers/test_kml_writer.py` - 6 KML writer tests
- `backend/tests/test_conversion_endpoint.py` - 7 integration tests

## Decisions Made
- Shared _coords.py helper extracts coordinate column detection logic to avoid duplication between GeoJSON and KML writers
- CSV/Excel parsers use stdlib csv.reader and openpyxl (not pandas) for lightweight parsing, keeping consistency with existing parser pattern
- Writer functions return (bytes, list[str]) tuple for uniform partial conversion warning handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed python-multipart dependency**
- **Found during:** Task 2 (conversion endpoint)
- **Issue:** FastAPI requires python-multipart for File/Form parameters; not installed
- **Fix:** pip install python-multipart, added to requirements.txt
- **Files modified:** backend/requirements.txt
- **Verification:** All integration tests pass
- **Committed in:** ad70e16 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Missing dependency is standard for new endpoint with file uploads. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Conversion backend fully operational and tested
- Ready for frontend UI (format conversion page) in subsequent plans
- Writer pattern established for adding new output formats (e.g., Shapefile, LandXML)

---
*Phase: 12-format-conversion*
*Completed: 2026-03-29*
