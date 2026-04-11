# Phase 12: Format Conversion Tool - Research

**Researched:** 2026-03-29
**Domain:** File format conversion (survey data), FastAPI endpoints, React file upload/download UI
**Confidence:** HIGH

## Summary

Phase 12 builds a standalone format conversion tool that converts between 7 input survey formats (CSV, Excel, GeoJSON, Shapefile, KML/KMZ, LandXML, DXF) and 3 output formats (CSV, GeoJSON, KML). The core architecture is straightforward: reuse the existing `dispatch_parser()` pipeline to parse any input into a `ParseResult`, then run a format writer to produce output bytes. The conversion is stateless -- no DB records, no persistent storage.

The main implementation work is: (1) three writer functions (CSV, GeoJSON, KML) that consume `ParseResult`, (2) a FastAPI `/api/v1/convert` endpoint that accepts file upload + target format and returns the converted file, (3) a Next.js API proxy route for auth, and (4) a React page replacing the existing placeholder at `/tools/convert`.

**Primary recommendation:** Build writers as pure functions (`ParseResult -> bytes`) in a new `backend/app/writers/` module, add a single synchronous FastAPI endpoint, and build a simple three-step UI component.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Login required -- reuse existing auth middleware
- Temporary storage only -- upload -> convert -> serve download -> delete. No permanent storage, no conversion history
- Same 50MB upload limit as main file upload
- Reuse existing FileUploadZone (react-dropzone) component, adapted for standalone context
- Three-step flow on one page: Upload -> Pick target format -> Download
- No preview step -- keep it minimal and fast
- One file at a time (no batch conversion)
- After conversion: show download button + summary (file name, input/output formats, row count, file size) with option to convert another file
- Input formats: All 7 supported parsers (CSV, Excel, GeoJSON, Shapefile, KML/KMZ, LandXML, DXF)
- Output formats: CSV, GeoJSON, KML (three most practical for survey workflows)
- Smart filtering: only show valid target formats for the uploaded file (exclude same-format, exclude spatial outputs when input has no coordinates)
- CSV output includes all columns -- no column picker
- API endpoint (FastAPI) handles conversion logic; UI calls the API. Opens door for Enterprise programmatic access later
- Inline error message in the conversion area with clear explanation of what went wrong, plus "Convert another" button
- Partial conversion supported: convert what works, show warning with count of skipped rows and reason
- Simple spinner + status text ("Converting DXF to GeoJSON...") during conversion
- No progress bar -- most conversions are fast (<5s)
- Purely stateless -- no conversion history, no DB records. Each visit starts fresh

### Claude's Discretion
- Exact layout and spacing of the conversion page
- How to adapt FileUploadZone for standalone use (props, callbacks)
- GeoJSON/KML writer implementation details
- Temporary file cleanup strategy (in-memory vs disk)
- Exact error message wording

### Deferred Ideas (OUT OF SCOPE)
- Batch conversion (multiple files at once) -- future enhancement
- Column picker for CSV output -- add if users request
- DXF/LandXML/Shapefile/Excel as output formats -- complex writers, add based on demand
- Conversion history with re-download -- would need DB table and persistent storage
- Tier-based size limits for conversion -- could differentiate paid tiers later
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 12 does not have formal requirement IDs in REQUIREMENTS.md (it was added post-roadmap as a tools feature). The implicit requirements derived from CONTEXT.md decisions are:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | User can upload any supported format file for conversion | Reuse dispatch_parser() + PARSER_REGISTRY from Phase 11 |
| CONV-02 | User can select target format (CSV, GeoJSON, KML) with smart filtering | Writer module + spatial detection logic |
| CONV-03 | System converts file and provides download | FastAPI /api/v1/convert endpoint with StreamingResponse |
| CONV-04 | Conversion handles errors gracefully with clear messages | FastAPI error handling + frontend inline error display |
| CONV-05 | Partial conversions succeed with warnings | Writer functions return warnings alongside output bytes |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115 | Conversion API endpoint | Already used for parse/validate/report endpoints |
| lxml | >=5.0 | KML writer (XML generation) | Already installed for KML parser |
| pandas | >=2.2 | CSV writer from ParseResult | Already installed, used in dataset_export.py |
| react-dropzone | (existing) | File upload in conversion UI | Already used in FileUploadZone component |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (stdlib) | - | GeoJSON writer | No external dependency needed |
| io (stdlib) | - | In-memory byte buffers | All writers produce BytesIO |
| csv (stdlib) | - | Alternative to pandas for CSV writing | Simpler, no pandas overhead |

### No New Dependencies Required
All output formats (CSV, GeoJSON, KML) can be written with libraries already in `requirements.txt` or Python stdlib. CSV uses `csv` stdlib module (simpler than pandas for this use case). GeoJSON uses `json` stdlib. KML uses `lxml` (already installed).

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  writers/
    __init__.py          # write_csv, write_geojson, write_kml exports
    csv_writer.py        # ParseResult -> CSV bytes
    geojson_writer.py    # ParseResult -> GeoJSON bytes
    kml_writer.py        # ParseResult -> KML bytes
  routers/
    conversion.py        # POST /api/v1/convert endpoint
  parsers/               # (existing) dispatch_parser -> ParseResult

src/app/
  api/convert/
    route.ts             # Next.js proxy: auth check -> forward to FastAPI
  (dashboard)/tools/convert/
    page.tsx             # Server component wrapper (auth check)
    converter.tsx        # Client component: upload -> select format -> download
```

### Pattern 1: Writer Functions (ParseResult -> bytes)
**What:** Pure functions that take a ParseResult and return output bytes, mirroring the parser pattern.
**When to use:** Every conversion output format.
**Example:**
```python
# backend/app/writers/csv_writer.py
import csv
import io
from app.parsers.base import ParseResult

def write_csv(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert ParseResult to CSV bytes.

    Returns:
        Tuple of (csv_bytes, warnings)
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(result.headers)
    writer.writerows(result.rows)
    return buf.getvalue().encode("utf-8"), []
```

### Pattern 2: Synchronous File Upload + Convert Endpoint
**What:** Single POST endpoint that accepts multipart file upload + target_format parameter, parses, converts, and returns the converted file as a streaming response.
**When to use:** The conversion endpoint. Unlike the existing parse endpoint (which reads from Supabase Storage), this accepts raw file upload directly because conversion is stateless.
**Example:**
```python
# backend/app/routers/conversion.py
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse
import io

router = APIRouter(prefix="/api/v1", tags=["conversion"])

@router.post("/convert")
def convert_file(
    file: UploadFile = File(...),
    target_format: str = Form(...),
):
    file_bytes = file.file.read()
    # parse -> write -> return StreamingResponse
```

### Pattern 3: Next.js API Route Proxy (Auth Only)
**What:** Next.js API route that checks auth, then forwards the multipart request to FastAPI.
**When to use:** All FastAPI calls from the frontend need auth gating.
**Example:**
```typescript
// src/app/api/convert/route.ts
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Forward the multipart form data directly to FastAPI
  const formData = await request.formData()
  const response = await fetch(`${process.env.FASTAPI_URL}/api/v1/convert`, {
    method: 'POST',
    body: formData,
  })
  // Stream the response back (converted file)
}
```

### Pattern 4: Spatial Detection for Smart Filtering
**What:** Detect whether a parsed file has coordinate columns to determine valid output formats.
**When to use:** Smart target format filtering on the frontend.
**Logic:**
- Input has longitude/latitude columns -> all three outputs valid (CSV, GeoJSON, KML)
- Input has NO coordinate columns (e.g., plain CSV with text data) -> only CSV output valid
- Same-format excluded (e.g., GeoJSON input cannot target GeoJSON)
- CSV/Excel inputs: detect by checking ParseResult headers for coordinate-like columns (longitude, latitude, easting, northing, x, y, lon, lat)
- Geospatial inputs (GeoJSON, Shapefile, KML, LandXML, DXF): always have coordinates

**Implementation:** The FastAPI endpoint can return available target formats after parsing, OR the frontend can use a static mapping based on source format (simpler, since all geospatial parsers always produce coordinates).

**Recommendation:** Use a static mapping on the frontend. All geospatial formats (GeoJSON, Shapefile, KML/KMZ, LandXML, DXF) always produce spatial data. CSV/Excel may or may not -- for simplicity, always offer all three outputs for CSV/Excel (the GeoJSON/KML writers will simply omit geometry if no coordinate columns are found, producing valid but non-spatial output).

### Anti-Patterns to Avoid
- **Writing to disk:** All conversion should happen in-memory using BytesIO/StringIO. Files are small enough (50MB limit) and conversion is fast. No temp file cleanup needed.
- **Storing conversion results:** The decision is purely stateless. No DB records, no Supabase storage. The converted file goes directly from FastAPI response to browser download.
- **Reusing the existing parse API route:** The existing `/api/parse` route is dataset-aware (reads from Supabase Storage, updates dataset records). Conversion needs a separate, clean endpoint that accepts raw file bytes.
- **Using pandas for CSV writing:** overkill for this -- `csv.writer` from stdlib is simpler and sufficient since ParseResult is already `list[list[str]]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KML XML generation | String concatenation | lxml.etree.SubElement | Proper XML escaping, namespace handling |
| GeoJSON coordinate detection | Custom regex parsing | Check ParseResult.headers for known column names | Headers are normalized by parsers |
| CSV encoding | Manual encoding | csv.writer with StringIO + .encode('utf-8') | Handles quoting, escaping, newlines |
| Multipart file forwarding | Manual body construction | Pass formData directly to fetch() | Browser FormData API handles boundaries |

## Common Pitfalls

### Pitfall 1: GeoJSON Writer Needs Coordinate Column Detection
**What goes wrong:** The GeoJSON writer needs to identify which columns are longitude/latitude to construct Feature geometries, but column names vary across source formats.
**Why it happens:** Different parsers use different header names -- geojson_parser uses "longitude"/"latitude", kml_parser uses "longitude"/"latitude", dxf_parser may use "x"/"y", CSV files could use anything.
**How to avoid:** Build a coordinate column detector that checks headers against a known set: `{"longitude", "lon", "x", "easting"}` for X, `{"latitude", "lat", "y", "northing"}` for Y, `{"elevation", "elev", "z", "height"}` for Z. Also check `ParseResult.source_format` -- geospatial formats always have these columns.
**Warning signs:** GeoJSON output with null geometries when coordinates exist under different column names.

### Pitfall 2: KML Requires Valid Coordinates
**What goes wrong:** KML spec requires coordinates as "lon,lat,alt" strings. If source data has easting/northing (projected coordinates, not WGS84), the KML viewer will display points in wrong locations.
**Why it happens:** Project explicitly defers CRS transformations (Out of Scope in REQUIREMENTS.md).
**How to avoid:** Add a warning in the conversion response: "Coordinates written as-is. KML viewers expect WGS84 (longitude/latitude). If your data uses projected coordinates, positions may appear incorrect." This is informational, not blocking.
**Warning signs:** Points appearing at 0,0 or in wrong hemisphere.

### Pitfall 3: Multipart Form Data Forwarding in Next.js
**What goes wrong:** Next.js API route receives the multipart form data from the browser but incorrectly re-encodes it when forwarding to FastAPI.
**Why it happens:** Reading `request.formData()` and creating a new FormData to forward can lose file metadata or change content-type boundaries.
**How to avoid:** Forward the raw request body with the original content-type header directly to FastAPI. Do NOT re-parse and re-create the FormData. Example:
```typescript
const contentType = request.headers.get('content-type') || ''
const body = await request.arrayBuffer()
const response = await fetch(`${fastApiUrl}/api/v1/convert`, {
  method: 'POST',
  headers: { 'Content-Type': contentType },
  body: body,
})
```
**Warning signs:** FastAPI returns 422 "validation error" for missing file field.

### Pitfall 4: Large File Memory Usage
**What goes wrong:** Loading a 50MB file into memory, parsing it (which may expand rows), then writing output -- could consume significant memory.
**Why it happens:** ParseResult stores all rows as `list[list[str]]` in memory.
**How to avoid:** This is acceptable for the 50MB limit. A 50MB CSV might expand to ~100-200MB in memory as ParseResult. Single-user conversions are fine. Just ensure the endpoint is synchronous (`def`, not `async def`) so it runs in a thread pool and doesn't block the event loop.
**Warning signs:** Server OOM on small instances. Monitor memory if this becomes an issue.

### Pitfall 5: File Download in the Browser
**What goes wrong:** The browser doesn't trigger a file download from a fetch() response; it needs special handling.
**Why it happens:** fetch() returns a Response object, not an auto-download.
**How to avoid:** Create a Blob from the response, generate an object URL, and trigger download via a hidden anchor element:
```typescript
const blob = await response.blob()
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'converted-file.geojson'
a.click()
URL.revokeObjectURL(url)
```
**Warning signs:** Nothing happens after clicking "Download", or file opens in a new tab instead.

## Code Examples

### CSV Writer
```python
# backend/app/writers/csv_writer.py
import csv
import io
from app.parsers.base import ParseResult

def write_csv(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert ParseResult to CSV bytes."""
    warnings: list[str] = []
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(result.headers)
    writer.writerows(result.rows)
    return buf.getvalue().encode("utf-8"), warnings
```

### GeoJSON Writer
```python
# backend/app/writers/geojson_writer.py
import json
from app.parsers.base import ParseResult

# Column names that indicate longitude (X coordinate)
LON_NAMES = {"longitude", "lon", "x", "easting", "long"}
LAT_NAMES = {"latitude", "lat", "y", "northing"}
ELEV_NAMES = {"elevation", "elev", "z", "height", "altitude"}

def _find_column(headers: list[str], candidates: set[str]) -> int | None:
    """Find first header matching any candidate name (case-insensitive)."""
    for i, h in enumerate(headers):
        if h.lower().strip() in candidates:
            return i
    return None

def write_geojson(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert ParseResult to GeoJSON FeatureCollection bytes."""
    warnings: list[str] = []
    lon_idx = _find_column(result.headers, LON_NAMES)
    lat_idx = _find_column(result.headers, LAT_NAMES)
    elev_idx = _find_column(result.headers, ELEV_NAMES)

    has_coords = lon_idx is not None and lat_idx is not None
    if not has_coords:
        warnings.append("No coordinate columns found; features will have null geometry")

    features = []
    skipped = 0
    for row in result.rows:
        properties = {}
        for i, h in enumerate(result.headers):
            if i in (lon_idx, lat_idx, elev_idx):
                continue
            properties[h] = row[i] if i < len(row) else ""

        geometry = None
        if has_coords:
            try:
                lon = float(row[lon_idx])
                lat = float(row[lat_idx])
                coords = [lon, lat]
                if elev_idx is not None and row[elev_idx]:
                    coords.append(float(row[elev_idx]))
                geometry = {"type": "Point", "coordinates": coords}
            except (ValueError, IndexError):
                skipped += 1
                continue

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": properties,
        })

    if skipped > 0:
        warnings.append(f"{skipped} rows skipped due to invalid coordinates")

    fc = {"type": "FeatureCollection", "features": features}
    return json.dumps(fc, indent=2).encode("utf-8"), warnings
```

### KML Writer
```python
# backend/app/writers/kml_writer.py
import io
from lxml import etree
from app.parsers.base import ParseResult

KML_NS = "http://www.opengis.net/kml/2.2"
NSMAP = {None: KML_NS}

# Same coordinate detection as geojson_writer
LON_NAMES = {"longitude", "lon", "x", "easting", "long"}
LAT_NAMES = {"latitude", "lat", "y", "northing"}
ELEV_NAMES = {"elevation", "elev", "z", "height", "altitude"}

def write_kml(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert ParseResult to KML bytes."""
    warnings: list[str] = []
    # ... find lon/lat/elev columns same as GeoJSON writer ...

    kml = etree.Element("kml", nsmap=NSMAP)
    doc = etree.SubElement(kml, "Document")
    name_el = etree.SubElement(doc, "name")
    name_el.text = "Converted Data"

    # Build Placemark per row
    for row in result.rows:
        pm = etree.SubElement(doc, "Placemark")
        # ... build name from first non-coordinate column ...
        # ... build coordinates element ...
        # ... build ExtendedData for remaining columns ...

    tree = etree.ElementTree(kml)
    buf = io.BytesIO()
    tree.write(buf, xml_declaration=True, encoding="UTF-8", pretty_print=True)
    return buf.getvalue(), warnings
```

### FastAPI Conversion Endpoint
```python
# backend/app/routers/conversion.py
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
import io

from app.parsers import dispatch_parser
from app.writers import write_csv, write_geojson, write_kml

router = APIRouter(prefix="/api/v1", tags=["conversion"])

WRITERS = {
    "csv": (write_csv, "text/csv", ".csv"),
    "geojson": (write_geojson, "application/geo+json", ".geojson"),
    "kml": (write_kml, "application/vnd.google-earth.kml+xml", ".kml"),
}

@router.post("/convert")
def convert_file(
    file: UploadFile = File(...),
    target_format: str = Form(...),
):
    if target_format not in WRITERS:
        raise HTTPException(400, f"Unsupported target: {target_format}")

    file_bytes = file.file.read()
    filename = file.filename or "unknown"

    # Parse input
    try:
        parse_result = dispatch_parser(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Write output
    writer_fn, media_type, ext = WRITERS[target_format]
    output_bytes, warnings = writer_fn(parse_result)

    # Build output filename
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    out_name = f"{base}{ext}"

    return StreamingResponse(
        io.BytesIO(output_bytes),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Conversion-Warnings": "|".join(warnings) if warnings else "",
            "X-Row-Count": str(parse_result.total_rows),
            "X-Source-Format": parse_result.source_format,
        },
    )
```

### Next.js Proxy Route
```typescript
// src/app/api/convert/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const fastApiUrl = process.env.FASTAPI_URL
  if (!fastApiUrl) {
    return NextResponse.json({ error: 'Conversion service unavailable' }, { status: 503 })
  }

  // Forward raw body with original content-type to preserve multipart boundaries
  const contentType = request.headers.get('content-type') || ''
  const body = await request.arrayBuffer()

  const response = await fetch(`${fastApiUrl}/api/v1/convert`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: body,
  })

  if (!response.ok) {
    const error = await response.text()
    return NextResponse.json({ error }, { status: response.status })
  }

  // Stream converted file back to client
  const blob = await response.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': response.headers.get('content-disposition') || '',
      'X-Conversion-Warnings': response.headers.get('x-conversion-warnings') || '',
      'X-Row-Count': response.headers.get('x-row-count') || '',
      'X-Source-Format': response.headers.get('x-source-format') || '',
    },
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GDAL/ogr2ogr for format conversion | Python stdlib + lxml for simple formats | N/A | Avoids massive GDAL dependency; sufficient for tabular + simple point data |
| Temporary file on disk | In-memory BytesIO/StringIO | N/A | No cleanup needed, simpler code |

**Why not GDAL:** GDAL/OGR is the standard for full geospatial format conversion but adds ~500MB of C dependencies. The project's formats are simple enough (tabular data with point coordinates) that Python stdlib + lxml handles all three output formats without GDAL.

## Open Questions

1. **Coordinate column naming consistency**
   - What we know: Geospatial parsers (GeoJSON, KML, Shapefile, DXF, LandXML) all produce "longitude"/"latitude" headers. CSV/Excel files could have any column names.
   - What's unclear: Whether CSV/Excel files with "easting"/"northing" (projected coordinates) should be written to GeoJSON/KML as-is
   - Recommendation: Write as-is with a warning. CRS transformation is explicitly out of scope per REQUIREMENTS.md.

2. **How to communicate warnings to the UI**
   - What we know: The endpoint can return warnings via response headers
   - What's unclear: Whether response headers are the cleanest approach vs a JSON envelope
   - Recommendation: Use custom response headers (`X-Conversion-Warnings`, `X-Row-Count`). This keeps the response body as the pure file content while still conveying metadata. The frontend reads headers before consuming the blob.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0 |
| Config file | backend/tests/conftest.py (existing fixtures) |
| Quick run command | `cd backend && python -m pytest tests/writers/ -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | Parse any supported format for conversion | integration | `cd backend && python -m pytest tests/test_conversion_endpoint.py::test_convert_csv_to_geojson -x` | Wave 0 |
| CONV-02 | Smart target format filtering | unit | `cd backend && python -m pytest tests/writers/test_writers.py -x` | Wave 0 |
| CONV-03 | Convert and download file | integration | `cd backend && python -m pytest tests/test_conversion_endpoint.py -x` | Wave 0 |
| CONV-04 | Error handling for invalid files | unit | `cd backend && python -m pytest tests/test_conversion_endpoint.py::test_convert_invalid_format -x` | Wave 0 |
| CONV-05 | Partial conversion with warnings | unit | `cd backend && python -m pytest tests/writers/test_geojson_writer.py::test_partial_rows -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/writers/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/writers/__init__.py` -- new test package
- [ ] `backend/tests/writers/test_csv_writer.py` -- CSV writer unit tests
- [ ] `backend/tests/writers/test_geojson_writer.py` -- GeoJSON writer unit tests
- [ ] `backend/tests/writers/test_kml_writer.py` -- KML writer unit tests
- [ ] `backend/tests/test_conversion_endpoint.py` -- integration tests for the FastAPI endpoint

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/app/parsers/base.py` -- ParseResult dataclass is the shared contract
- Project codebase: `backend/app/parsers/__init__.py` -- dispatch_parser and PARSER_REGISTRY
- Project codebase: `backend/app/routers/parsing.py` -- existing endpoint pattern
- Project codebase: `src/app/api/parse/route.ts` -- existing proxy pattern with auth
- Project codebase: `src/components/files/file-upload-zone.tsx` -- existing upload component
- Project codebase: `src/app/(dashboard)/tools/convert/page.tsx` -- placeholder to replace
- Python stdlib csv module documentation -- csv.writer for output
- Python stdlib json module -- GeoJSON output

### Secondary (MEDIUM confidence)
- lxml etree documentation for KML generation -- same library already used in KML parser
- FastAPI UploadFile + StreamingResponse patterns -- standard FastAPI file handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, no new dependencies
- Architecture: HIGH - follows established parser/router/proxy patterns in the codebase
- Pitfalls: HIGH - identified from direct code inspection (multipart forwarding, coordinate naming, file download)

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- no external dependencies changing)
