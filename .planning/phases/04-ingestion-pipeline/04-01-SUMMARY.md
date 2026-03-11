---
phase: 04-ingestion-pipeline
plan: 01
subsystem: parsing
tags: [csv, excel, papaparse, sheetjs, tdd, vitest, column-detection, header-detection]

requires:
  - phase: 02-project-structure
    provides: SurveyType enum for column detection context
provides:
  - parseCSV function with BOM handling and delimiter auto-detection
  - parseExcel function with sheet selection and string coercion
  - detectHeaderRow for messy files with metadata preamble
  - detectColumns with confidence scoring (high/medium/low)
  - getMissingExpectedColumns for survey-type-aware validation
  - ParsedFileData, ExcelParseResult, DetectedColumn, SurveyColumnType types
affects: [04-ingestion-pipeline, 05-validation-engine]

tech-stack:
  added: [papaparse, xlsx (SheetJS)]
  patterns: [pure-function parsing, confidence-scored detection, TDD with vitest]

key-files:
  created:
    - src/lib/parsing/types.ts
    - src/lib/parsing/csv-parser.ts
    - src/lib/parsing/excel-parser.ts
    - src/lib/parsing/header-detector.ts
    - src/lib/parsing/column-detector.ts
    - tests/parsing/csv-parser.test.ts
    - tests/parsing/excel-parser.test.ts
    - tests/parsing/header-detector.test.ts
    - tests/parsing/column-detector.test.ts
    - tests/fixtures/sample.csv
    - tests/fixtures/sample-bom.csv
    - tests/fixtures/sample-metadata-rows.csv
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "PapaParse with header:false for raw string[][] output -- keeps parsing generic before column detection"
  - "SheetJS raw:false with defval:'' for consistent string output matching CSV parser format"
  - "Confidence scoring: high (name+data match), medium (name only), low (data only or neither)"
  - "Expected columns per survey type defined in column-detector for missing-column warnings"

patterns-established:
  - "Pure function pattern: all parsing functions are stateless, no side effects"
  - "Confidence scoring pattern: detection results carry confidence level for UI display"
  - "Data sampling pattern: sample up to 100 data rows for type inference"

requirements-completed: [FILE-02, PROC-03]

duration: 4min
completed: 2026-03-11
---

# Phase 4 Plan 1: Parsing Engine Summary

**CSV/Excel parsers with BOM handling, header row detection in messy files, and column type auto-detection with confidence scoring using papaparse and SheetJS**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T02:56:15Z
- **Completed:** 2026-03-11T03:00:27Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- CSV parser with BOM stripping, delimiter auto-detection (comma/tab/semicolon), and empty line skipping
- Excel parser with sheet selection, multi-sheet support, and empty cell handling
- Header row detector that skips metadata preamble rows, empty rows, and key:value patterns
- Column type detector matching 14 survey column types by name patterns and data sampling
- Survey-type-aware missing column detection for DOB, DOC, TOP, Event Listing, Pipeline Position, ROVV
- 31 tests across 4 test files, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Parsing types, CSV parser, and Excel parser** - `f4f8b03` (feat)
2. **Task 2: Header detector and column type detector** - `06727c1` (feat)

## Files Created/Modified
- `src/lib/parsing/types.ts` - SurveyColumnType, DetectedColumn, ColumnMapping, ParsedFileData, ExcelParseResult, ParseWarning types
- `src/lib/parsing/csv-parser.ts` - parseCSV with BOM handling, delimiter auto-detection, empty line skipping
- `src/lib/parsing/excel-parser.ts` - parseExcel with sheet selection, string coercion, defval handling
- `src/lib/parsing/header-detector.ts` - detectHeaderRow scanning first 20 rows with metadata/empty row skipping
- `src/lib/parsing/column-detector.ts` - detectColumns with name pattern matching and data sampling, getMissingExpectedColumns
- `tests/parsing/csv-parser.test.ts` - 9 tests for CSV parsing
- `tests/parsing/excel-parser.test.ts` - 5 tests for Excel parsing
- `tests/parsing/header-detector.test.ts` - 7 tests for header detection
- `tests/parsing/column-detector.test.ts` - 10 tests for column detection
- `tests/fixtures/sample.csv` - Standard survey data fixture
- `tests/fixtures/sample-bom.csv` - BOM-prefixed survey data fixture
- `tests/fixtures/sample-metadata-rows.csv` - Survey data with metadata preamble

## Decisions Made
- PapaParse with `header: false` for raw string[][] output, keeping parsing generic before column detection
- SheetJS `raw: false` with `defval: ''` for consistent string output matching CSV parser format
- Confidence scoring: high when both name regex and data pattern match, medium for name only, low for data only
- Expected columns defined per survey type in column-detector module for missing-column warnings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All parsing pure functions ready for integration into ingestion pipeline
- Column detection types feed directly into validation engine (Phase 5)
- Header detection enables auto-parsing of messy survey files without user configuration

## Self-Check: PASSED

All 12 files verified present. Both task commits (f4f8b03, 06727c1) verified in git log.

---
*Phase: 04-ingestion-pipeline*
*Completed: 2026-03-11*
