# Phase 13: Map Visualization - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone map visualization tool at `/tools/visualize`. Users upload spatial files and see them plotted on an interactive map with layer controls, tooltips, coordinate display, and measurement tools. No project/job context required — this is a standalone tool like the format converter.

</domain>

<decisions>
## Implementation Decisions

### Data Source & Upload Flow
- Standalone upload tool — no connection to projects/datasets
- No login required — public tool, anyone can upload and visualize
- Accepted formats: GeoJSON, KML/KMZ, Shapefile (common spatial formats only — not CSV/Excel/LandXML/DXF)
- Multi-file upload supported — each file becomes a separate layer
- Session-based memory — plotted data persists in browser session so users can reload without re-uploading
- No server persistence, no database records, no visualization history

### Map Display & Base Maps
- Multiple base map options with tile layer switcher: OpenStreetMap, satellite imagery (ESRI World Imagery), and topographic map
- Auto-fit bounds on data load — zoom/pan to fit all uploaded features
- Zoom-to-fit button to re-center after user pans away
- Persistent cursor coordinate readout in corner of map (lat/lng as mouse moves)

### Feature Interactions
- Hover tooltip showing brief info (name/label of feature)
- Click opens detailed popup with all attributes from the source file
- Two levels of information: quick hover context + full click detail

### Layer Controls & Styling
- Each uploaded file becomes a toggleable layer
- Auto-assigned colors per layer
- Color picker per layer for user customization
- Layer panel shows filename + feature count (e.g., "pipeline_route.kml — 342 points")
- Toggle visibility on/off per layer

### Data Table
- Optional collapsible data table panel (hidden by default)
- User can toggle to show attribute table for the selected layer
- Click a row in the table to zoom to that feature on the map

### Page Layout
- Full-width map with floating panels (layer controls, upload zone, data table)
- Panels are collapsible to maximize map space
- Replace existing "Coming Soon" placeholder at `/tools/visualize`

### Export
- PNG screenshot button to capture current map view as image
- No shareable URLs for MVP
- No data export from the map tool (converter handles format conversion separately)

### Measurement Tools
- Distance measurement tool — click points to measure distance between them
- No area measurement for MVP

### Claude's Discretion
- Map library choice (Leaflet with react-leaflet recommended given it's free and well-suited)
- Exact floating panel positions and collapse behavior
- Tooltip and popup styling
- Color palette for auto-assigned layer colors
- Session storage implementation details (sessionStorage vs in-memory)
- Screenshot implementation approach (html2canvas or leaflet plugin)
- Distance measurement UI (Leaflet.Draw or custom)
- How to handle very large files / feature counts (clustering, simplification)

</decisions>

<specifics>
## Specific Ideas

- Matches the Phase 12 converter pattern: standalone tool, temporary processing, no project context
- Survey engineers work with coordinates daily — the cursor readout and measurement tools are high-value features
- Multi-layer support enables the common workflow of overlaying pipeline route + inspection points + as-built survey

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParseResult` dataclass (`backend/app/parsers/base.py`): standard output from all parsers — headers, rows, metadata
- `dispatch_parser()` / `PARSER_REGISTRY` (`backend/app/parsers/__init__.py`): routes files to parsers by extension
- `_coords.py` (`backend/app/writers/_coords.py`): coordinate column detection (lon/lat/easting/northing names)
- `flatten_geometry()` (`backend/app/parsers/base.py`): coordinate normalization helper
- Converter UI patterns (`src/app/(dashboard)/tools/convert/`): standalone tool page structure, upload flow

### Established Patterns
- FastAPI endpoints with Next.js API route proxy (auth in Next.js, processing in FastAPI)
- For no-auth tool: may parse client-side or use a public API endpoint
- `react-dropzone` for file upload UI
- Blob URL download pattern (Phase 12) for PNG export

### Integration Points
- `/tools/visualize` page exists as placeholder — replace with functional map
- Sidebar navigation already links to Visualize tool
- No backend dependency needed if parsing happens client-side with JS libraries
- Alternatively, reuse FastAPI parsers via API endpoint (but auth question changes this)

</code_context>

<deferred>
## Deferred Ideas

- CSV/Excel support for map (would need coordinate column detection UI)
- LandXML/DXF map support (complex geometry types)
- Shareable map URLs with encoded state
- Data export from map view (GeoJSON/CSV of visible features)
- Area measurement tool
- Batch upload / drag multiple files at once
- Feature filtering by attribute values
- Heatmap or density visualization mode
- Integration with project datasets (plot QC results on map)

</deferred>

---

*Phase: 13-map-visualization*
*Context gathered: 2026-03-29*
