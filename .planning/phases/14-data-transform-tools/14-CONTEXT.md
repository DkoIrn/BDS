# Phase 14: Data Transform Tools - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Three standalone transform tools at `/tools/transform`: CRS conversion, merge datasets, and split by criteria. Each tool follows the upload → configure → download pattern. Login required, stateless (no history/persistence). Auto-clean is deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### Tool Scope
- 3 tools for this phase: CRS conversion, merge, split
- Auto-clean deferred — depends on QC results integration, more complex
- Each tool is a separate sub-page under `/tools/transform`

### Page Structure
- Landing page at `/tools/transform` shows capability cards (already exist as placeholder)
- Click a card to go to tool-specific page: `/tools/transform/crs`, `/tools/transform/merge`, `/tools/transform/split`
- Auto-clean card shows "Coming Soon" badge
- Each tool follows the same 3-step pattern: Upload → Configure options → Download result

### Auth & Storage
- Login required (matches converter pattern)
- Fully stateless — no database records, no transform history
- Same 50MB upload limit as existing tools

### Input Formats
- Accept all supported formats (CSV, Excel, GeoJSON, Shapefile ZIP, KML/KMZ, LandXML, DXF)
- ParseResult normalizes everything to tabular form for transforms

### CRS Conversion
- Supported systems: WGS84 (EPSG:4326), UTM zones, OSGB36 (EPSG:27700 — British National Grid)
- Auto-detect source CRS from file metadata/coordinate patterns
- If CRS not detected: show warning, force user to select manually
- User picks target CRS from supported list
- Coordinate columns auto-detected using existing `_coords.py` logic

### Merge Datasets
- Multi-file upload: support both drag-multiple and add-one-at-a-time
- Union all columns — missing values filled with empty/null
- Files listed in upload order, user can see file list before merging
- Output is a single merged file

### Split Dataset
- Two split modes: by KP range OR by column value
- KP range: user specifies start/end KP values for each split
- Column value: user picks a column, system splits into one file per unique value
- Produces multiple output files

### Output & Download
- User picks output format after transform (CSV, GeoJSON, KML) — reuse converter's writer logic
- Default output format: same as input, fallback to GeoJSON if no writer for input format
- Summary + preview + download: show stats (rows in, rows out, columns), preview table of first ~20 rows, then download
- Split tool: show individual file downloads AND a "Download all as ZIP" button

### Progress Feedback
- Simple spinner + status text during transform (e.g., "Converting coordinates...")
- No progress bar — most transforms are fast (<5s)
- Inline error messages with plain English explanations (existing error pattern)

### Claude's Discretion
- Exact CRS detection algorithm (pyproj or manual heuristics)
- How to determine UTM zone from coordinates
- Preview table component implementation (reuse existing data-preview-table or new)
- ZIP file creation approach for split output
- Exact layout of configuration panels per tool
- How to handle edge cases (empty files, single-row files, no coordinate columns for CRS)

</decisions>

<specifics>
## Specific Ideas

- Reuse converter's three-step UI pattern — users already know the flow
- Landing page with capability cards already exists as placeholder — make cards clickable to sub-pages
- ParseResult as shared contract means all 7 input formats work through the same transform pipeline
- CRS with OSGB36 is high-value for UK survey market (primary target)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParseResult` dataclass (`backend/app/parsers/base.py`): standardized tabular output from all parsers
- `dispatch_parser()` / `PARSER_REGISTRY` (`backend/app/parsers/__init__.py`): routes files to parsers by extension
- `_coords.py` (`backend/app/writers/_coords.py`): coordinate column detection (lon/lat/easting/northing)
- CSV/GeoJSON/KML writers (`backend/app/writers/`): output format logic already built
- Converter UI patterns (`src/app/(dashboard)/tools/convert/`): three-step flow, auth proxy, file upload
- `react-dropzone` for upload UI

### Established Patterns
- FastAPI endpoints with Next.js API route proxy (auth in Next.js, processing in FastAPI)
- ParseResult as shared contract between parsers and consumers
- Inline react-dropzone for tool pages (Phase 12 pattern)
- Raw body forwarding for multipart in auth proxy
- Blob URL download for cross-browser file download

### Integration Points
- `/tools/transform` page exists as placeholder — make cards link to sub-pages
- Sidebar already links to Transform tool
- FastAPI app at `backend/app/` — add transform router(s)
- Next.js API routes at `src/app/api/` — add proxy routes
- Writers already exist for CSV, GeoJSON, KML output

</code_context>

<deferred>
## Deferred Ideas

- Auto-clean tool (fix flagged QC issues automatically) — depends on QC results integration
- Open CRS picker with full EPSG database search — start with curated list
- Progress bar for very large file transforms
- Batch transforms (apply same transform to multiple files)
- Transform history / saved presets
- Split by geographic region (bounding box on map)
- Split by fixed row count

</deferred>

---

*Phase: 14-data-transform-tools*
*Context gathered: 2026-03-30*
