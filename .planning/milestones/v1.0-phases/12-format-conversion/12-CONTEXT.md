# Phase 12: Format Conversion Tool - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone tool for converting between survey file formats. Users upload a file in any supported format and download it converted to a different format. This is separate from the project/job QC workflow — no project setup needed. The conversion API also serves as a programmatic endpoint for future Enterprise API access.

</domain>

<decisions>
## Implementation Decisions

### Upload & Storage Flow
- Login required — reuse existing auth middleware
- Temporary storage only — upload → convert → serve download → delete. No permanent storage, no conversion history
- Same 50MB upload limit as main file upload
- Reuse existing FileUploadZone (react-dropzone) component, adapted for standalone context

### Conversion UI Flow
- Three-step flow on one page: Upload → Pick target format → Download
- No preview step — keep it minimal and fast
- One file at a time (no batch conversion)
- After conversion: show download button + summary (file name, input/output formats, row count, file size) with option to convert another file

### Conversion Matrix
- Input formats: All 7 supported parsers (CSV, Excel, GeoJSON, Shapefile, KML/KMZ, LandXML, DXF)
- Output formats: CSV, GeoJSON, KML (three most practical for survey workflows)
- Smart filtering: only show valid target formats for the uploaded file (exclude same-format, exclude spatial outputs when input has no coordinates)
- CSV output includes all columns — no column picker
- API endpoint (FastAPI) handles conversion logic; UI calls the API. Opens door for Enterprise programmatic access later

### Error Handling
- Inline error message in the conversion area with clear explanation of what went wrong, plus "Convert another" button
- Partial conversion supported: convert what works, show warning with count of skipped rows and reason

### Conversion Feedback
- Simple spinner + status text ("Converting DXF to GeoJSON...") during conversion
- No progress bar — most conversions are fast (<5s)

### History
- Purely stateless — no conversion history, no DB records. Each visit starts fresh

### Claude's Discretion
- Exact layout and spacing of the conversion page
- How to adapt FileUploadZone for standalone use (props, callbacks)
- GeoJSON/KML writer implementation details
- Temporary file cleanup strategy (in-memory vs disk)
- Exact error message wording

</decisions>

<specifics>
## Specific Ideas

- Placeholder "Coming Soon" page already exists at `/tools/convert` — replace with functional converter
- Tools sidebar navigation already scaffolded with convert, compare, transform, visualize sections
- ParseResult dataclass is the bridge: parse input → ParseResult → write to target format

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParseResult` dataclass (`backend/app/parsers/base.py`): standardized tabular output from all parsers — headers, rows, metadata, source_format
- `dispatch_parser()` (`backend/app/parsers/__init__.py`): routes files to correct parser by extension
- `PARSER_REGISTRY`: maps extensions to parser functions for all 7 input formats
- `FileUploadZone` (`src/components/files/file-upload-zone.tsx`): drag-and-drop with react-dropzone, progress, validation
- `dataset_export.py` (`backend/app/services/dataset_export.py`): CSV/Excel export patterns with pandas/openpyxl (currently QC-annotated, but export patterns reusable)
- `flatten_geometry()` (`backend/app/parsers/base.py`): coordinate normalization helper

### Established Patterns
- FastAPI endpoints with Next.js API route proxy (auth check in Next.js, processing in FastAPI)
- Fire-and-forget pattern for async operations, but conversion should be synchronous (fast enough)
- ParseResult as shared contract between parsers and consumers

### Integration Points
- `/tools/convert` page already exists as placeholder — replace content
- Sidebar navigation already includes Tools > Convert link
- FastAPI app at `backend/app/` — add conversion router
- Next.js API routes at `src/app/api/` — add proxy route for conversion endpoint

</code_context>

<deferred>
## Deferred Ideas

- Batch conversion (multiple files at once) — future enhancement
- Column picker for CSV output — add if users request
- DXF/LandXML/Shapefile/Excel as output formats — complex writers, add based on demand
- Conversion history with re-download — would need DB table and persistent storage
- Tier-based size limits for conversion — could differentiate paid tiers later

</deferred>

---

*Phase: 12-format-conversion*
*Context gathered: 2026-03-29*
