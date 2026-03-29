# Phase 14: Data Transform Tools - Research

**Researched:** 2026-03-30
**Domain:** Survey data transformation (CRS conversion, dataset merge, dataset split)
**Confidence:** HIGH

## Summary

Phase 14 adds three standalone transform tools at `/tools/transform`: CRS conversion, merge datasets, and split by criteria. The existing codebase provides strong foundations -- the converter's three-step UI pattern (upload, configure, download), the ParseResult contract, the writer functions, and the auth proxy pattern can all be reused directly. The primary new capability is coordinate transformation via pyproj, which is the standard Python library for CRS operations.

The backend work is straightforward: three new FastAPI endpoints that accept file uploads, apply transforms to ParseResult data, and return converted output using existing writers. The frontend follows the established converter pattern with tool-specific configuration panels. The merge tool needs multi-file upload support (new pattern), and the split tool needs ZIP bundling for multiple output files (stdlib zipfile).

**Primary recommendation:** Add pyproj>=3.7 as the sole new dependency. Build three separate FastAPI endpoints following the conversion router pattern. Reuse existing parsers, writers, and _coords.py helpers. Frontend follows converter UI pattern with per-tool config panels.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 tools for this phase: CRS conversion, merge, split
- Auto-clean deferred to future phase
- Each tool is a separate sub-page under `/tools/transform`
- Landing page at `/tools/transform` shows capability cards (already exist as placeholder)
- Click a card to go to tool-specific page: `/tools/transform/crs`, `/tools/transform/merge`, `/tools/transform/split`
- Auto-clean card shows "Coming Soon" badge
- Each tool follows the same 3-step pattern: Upload, Configure options, Download result
- Login required (matches converter pattern)
- Fully stateless -- no database records, no transform history
- Same 50MB upload limit as existing tools
- Accept all supported formats (CSV, Excel, GeoJSON, Shapefile ZIP, KML/KMZ, LandXML, DXF)
- ParseResult normalizes everything to tabular form for transforms
- CRS: Supported systems WGS84 (EPSG:4326), UTM zones, OSGB36 (EPSG:27700)
- CRS: Auto-detect source CRS from file metadata/coordinate patterns; warn if not detected, force manual selection
- CRS: User picks target CRS from supported list
- CRS: Coordinate columns auto-detected using existing `_coords.py` logic
- Merge: Multi-file upload with drag-multiple and add-one-at-a-time
- Merge: Union all columns, missing values filled with empty/null
- Merge: Files listed in upload order, user sees file list before merging
- Merge: Output is a single merged file
- Split: Two modes -- by KP range OR by column value
- Split: KP range -- user specifies start/end KP for each split
- Split: Column value -- user picks column, splits into one file per unique value
- Split: Produces multiple output files
- Output format selection after transform (CSV, GeoJSON, KML) -- reuse converter's writer logic
- Default output format: same as input, fallback to GeoJSON
- Summary + preview + download: show stats, preview first ~20 rows, then download
- Split tool: individual file downloads AND "Download all as ZIP"
- Simple spinner + status text during transform (no progress bar)
- Inline error messages with plain English explanations

### Claude's Discretion
- Exact CRS detection algorithm (pyproj or manual heuristics)
- How to determine UTM zone from coordinates
- Preview table component implementation (reuse existing data-preview-table or new)
- ZIP file creation approach for split output
- Exact layout of configuration panels per tool
- How to handle edge cases (empty files, single-row files, no coordinate columns for CRS)

### Deferred Ideas (OUT OF SCOPE)
- Auto-clean tool (fix flagged QC issues automatically)
- Open CRS picker with full EPSG database search
- Progress bar for very large file transforms
- Batch transforms (apply same transform to multiple files)
- Transform history / saved presets
- Split by geographic region (bounding box on map)
- Split by fixed row count
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pyproj | >=3.7 | CRS coordinate transformation | Standard Python interface to PROJ library; handles WGS84/UTM/OSGB36 transforms correctly |
| zipfile (stdlib) | built-in | ZIP archive creation for split output | Standard library, no dependency needed, works with BytesIO for in-memory creation |

### Existing (Reused)
| Library | Already In | Purpose | Reuse |
|---------|-----------|---------|-------|
| ParseResult | backend/app/parsers/base.py | Normalized tabular data contract | All transforms operate on ParseResult |
| dispatch_parser | backend/app/parsers/__init__.py | Route files to parsers | Same file intake as converter |
| _coords.py | backend/app/writers/_coords.py | Coordinate column detection | CRS tool needs lon/lat/easting/northing detection |
| csv/geojson/kml writers | backend/app/writers/ | Output format generation | All tools reuse (bytes, warnings) writer pattern |
| react-dropzone | frontend | Drag-and-drop file upload | Same inline dropzone pattern as converter |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pyproj | Manual math formulas | pyproj handles datum shifts, grid corrections, edge cases; manual math only works for simple cases and breaks on OSGB36 |
| zipfile (stdlib) | External zip library | No benefit -- stdlib is sufficient for in-memory ZIP creation |

**Installation:**
```bash
# Backend only -- single new dependency
pip install pyproj>=3.7
```

Add to `backend/requirements.txt`:
```
# Phase 14: CRS coordinate transformation
pyproj>=3.7
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  routers/
    transform.py          # All 3 transform endpoints in one router
  transforms/
    __init__.py
    crs.py                # CRS conversion logic
    merge.py              # Merge datasets logic
    split.py              # Split dataset logic
    _detect_crs.py        # CRS auto-detection heuristics

src/app/(dashboard)/tools/transform/
  page.tsx                # Landing page with capability cards (update existing)
  crs/
    page.tsx              # CRS tool page wrapper
    crs-tool.tsx          # CRS tool client component
  merge/
    page.tsx              # Merge tool page wrapper
    merge-tool.tsx        # Merge tool client component
  split/
    page.tsx              # Split tool page wrapper
    split-tool.tsx        # Split tool client component

src/app/api/transform/
  crs/route.ts            # Auth proxy for CRS endpoint
  merge/route.ts          # Auth proxy for merge endpoint
  split/route.ts          # Auth proxy for split endpoint
```

### Pattern 1: Transform Function Signature
**What:** Each transform function takes ParseResult(s) + config, returns ParseResult (consistent with writer pipeline).
**When to use:** All three tools.
**Example:**
```python
# Each transform follows this contract
def transform_crs(
    result: ParseResult,
    source_epsg: int,
    target_epsg: int,
) -> tuple[ParseResult, list[str]]:
    """Transform coordinates in ParseResult from source to target CRS.
    Returns (transformed_result, warnings).
    """
    ...

def merge_datasets(
    results: list[ParseResult],
) -> tuple[ParseResult, list[str]]:
    """Merge multiple ParseResults into one (union columns).
    Returns (merged_result, warnings).
    """
    ...

def split_by_kp(
    result: ParseResult,
    ranges: list[tuple[float, float]],
) -> tuple[list[tuple[str, ParseResult]], list[str]]:
    """Split ParseResult by KP ranges.
    Returns (list of (label, result) pairs, warnings).
    """
    ...

def split_by_column(
    result: ParseResult,
    column_name: str,
) -> tuple[list[tuple[str, ParseResult]], list[str]]:
    """Split ParseResult by unique values in column.
    Returns (list of (value_label, result) pairs, warnings).
    """
    ...
```

### Pattern 2: Auth Proxy (Established)
**What:** Next.js API route checks auth via Supabase, forwards raw multipart body to FastAPI.
**When to use:** All three tool endpoints.
**Example:** Identical to `src/app/api/convert/route.ts` -- read raw body, forward with Content-Type, relay response.

### Pattern 3: Multi-File Upload for Merge
**What:** Accept multiple files in a single multipart request.
**When to use:** Merge tool only.
**Example:**
```python
# FastAPI endpoint accepting multiple files
from fastapi import File, UploadFile
from typing import List

@router.post("/merge")
def merge_files(
    files: List[UploadFile] = File(...),
    target_format: str = Form("csv"),
):
    # Parse each file into ParseResult
    results = []
    for f in files:
        file_bytes = f.file.read()
        results.append(dispatch_parser(file_bytes, f.filename or "unknown"))
    # Merge and write output
    ...
```

### Pattern 4: ZIP Response for Split
**What:** Return multiple files as a ZIP archive using stdlib zipfile + BytesIO.
**When to use:** Split tool when returning all files.
**Example:**
```python
import io
import zipfile

def create_zip(files: list[tuple[str, bytes]]) -> bytes:
    """Create in-memory ZIP from list of (filename, content_bytes)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files:
            zf.writestr(name, data)
    return buf.getvalue()
```

### Pattern 5: CRS Auto-Detection Heuristic
**What:** Detect source CRS from coordinate value ranges.
**When to use:** CRS tool when no CRS metadata in file.
**Example:**
```python
def detect_crs(lon_values: list[float], lat_values: list[float]) -> tuple[int | None, str]:
    """Detect CRS from coordinate ranges.
    Returns (epsg_code, confidence) where confidence is 'high'|'medium'|'none'.

    Heuristics:
    - lat in [-90, 90] and lon in [-180, 180] -> WGS84 (EPSG:4326)
    - easting in [0, 1_000_000] and northing in [0, 10_000_000] -> UTM (determine zone)
    - easting in [0, 700_000] and northing in [0, 1_300_000] -> OSGB36 (EPSG:27700)
    """
    ...
```

### Pattern 6: UTM Zone Detection
**What:** Determine UTM zone number from WGS84 coordinates or from easting/northing ranges.
**When to use:** CRS tool for auto-detection and target CRS selection.
**Example:**
```python
from pyproj import CRS
from pyproj.aoi import AreaOfInterest
from pyproj.database import query_utm_crs_info

def utm_zone_from_lonlat(lon: float, lat: float) -> int:
    """Get EPSG code for UTM zone containing the given WGS84 coordinate."""
    utm_crs_list = query_utm_crs_info(
        datum_name="WGS 84",
        area_of_interest=AreaOfInterest(
            west_lon_degree=lon,
            south_lat_degree=lat,
            east_lon_degree=lon,
            north_lat_degree=lat,
        ),
    )
    return int(utm_crs_list[0].code)
```

### Anti-Patterns to Avoid
- **Building CRS math manually:** Never implement datum transformations by hand -- pyproj wraps PROJ which handles grid shifts, datum corrections, and edge cases correctly.
- **Using pandas for simple merges:** ParseResult is string[][] -- merging is simple column union + row concatenation. No need to bring in pandas overhead for this.
- **Storing transform state in database:** These are stateless tools. No database tables, no history records.
- **Separate router files per tool:** One transform router with three endpoints is cleaner than three router files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coordinate transformation | Manual lat/lon math | pyproj Transformer | Datum shifts (WGS84 to OSGB36) require grid corrections that manual math gets wrong |
| UTM zone detection | Longitude math formula | pyproj query_utm_crs_info | Handles edge cases (zone exceptions in Norway/Svalbard) |
| ZIP file creation | Custom binary format | stdlib zipfile + BytesIO | Proven, cross-platform, handles compression |
| File parsing | New parsers | Existing dispatch_parser | All 7 formats already supported |
| Output format writing | New writers | Existing csv/geojson/kml writers | Already return (bytes, warnings) tuple |
| Coordinate column detection | New column finder | Existing _coords.py find_column | Already handles lon/lat/easting/northing name variants |

**Key insight:** The transform pipeline is: parse (existing) -> transform (new) -> write (existing). Only the middle step is new code.

## Common Pitfalls

### Pitfall 1: pyproj Axis Order
**What goes wrong:** pyproj defaults to authority-defined axis order (lat, lon for EPSG:4326), not the (lon, lat) order most people expect.
**Why it happens:** EPSG:4326 officially defines axes as (latitude, longitude), but GIS tools traditionally use (longitude, latitude).
**How to avoid:** Always use `always_xy=True` when creating Transformer:
```python
transformer = Transformer.from_crs(source_epsg, target_epsg, always_xy=True)
```
**Warning signs:** Coordinates appear swapped or wildly wrong after transformation.

### Pitfall 2: OSGB36 Detection False Positives
**What goes wrong:** UTM coordinates can overlap with OSGB36 easting/northing ranges, causing misdetection.
**Why it happens:** OSGB36 easting range (0-700,000) and northing range (0-1,300,000) overlap with some UTM zones.
**How to avoid:** Use multiple heuristics -- check column names first (if named "easting"/"northing" and values fit OSGB36 tightly, increase confidence). Always allow user override when detection confidence is not high.
**Warning signs:** CRS auto-detection returns wrong system for UK survey data.

### Pitfall 3: Merge Column Alignment
**What goes wrong:** Files with different column sets produce misaligned rows if not handled carefully.
**Why it happens:** ParseResult from different file types may have completely different headers.
**How to avoid:** Build a unified header list from all files (preserving order of first appearance), then pad each row with empty strings for missing columns.
**Warning signs:** Merged output has data in wrong columns.

### Pitfall 4: Multi-File Upload Boundary
**What goes wrong:** Raw body forwarding to FastAPI fails when multiple files are in the multipart form.
**Why it happens:** The multipart boundary must be preserved exactly. The existing pattern works for single files -- verify it works for multiple.
**How to avoid:** Test the multi-file proxy early. The raw body forwarding pattern (`request.arrayBuffer()` + Content-Type header) should work for multiple files, but verify.
**Warning signs:** FastAPI receives 0 files or malformed file data.

### Pitfall 5: Empty Split Results
**What goes wrong:** Split by column value produces empty files for values that appear in column but have no data rows (shouldn't happen but edge case with null values).
**Why it happens:** Null/empty column values create "ghost" splits.
**How to avoid:** Filter out splits with 0 rows. Warn user about filtered empty groups.
**Warning signs:** ZIP contains empty CSV files.

### Pitfall 6: KP Column Detection for Split
**What goes wrong:** Split by KP range fails because KP column not found.
**Why it happens:** ParseResult headers may use various names (KP, kp, Chainage, STA).
**How to avoid:** Reuse or extend the column detection pattern from _coords.py to include KP name variants.
**Warning signs:** "No KP column found" error on valid survey data.

## Code Examples

### CRS Transformation with pyproj
```python
# Source: pyproj 3.7.2 official docs
from pyproj import Transformer

def transform_coordinates(
    x_values: list[float],
    y_values: list[float],
    source_epsg: int,
    target_epsg: int,
) -> tuple[list[float], list[float]]:
    """Transform coordinate arrays between CRS."""
    transformer = Transformer.from_crs(
        source_epsg, target_epsg, always_xy=True
    )
    x_out, y_out = transformer.transform(x_values, y_values)
    return list(x_out), list(y_out)
```

### In-Memory ZIP Creation
```python
# Source: Python stdlib zipfile docs
import io
import zipfile

def create_zip_archive(files: list[tuple[str, bytes]]) -> bytes:
    """Create ZIP archive in memory from (filename, content) pairs."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, data in files:
            zf.writestr(filename, data)
    return buf.getvalue()
```

### Multi-File FastAPI Endpoint
```python
# Source: FastAPI docs - Request Files
from fastapi import APIRouter, File, Form, UploadFile
from typing import List

@router.post("/merge")
def merge_files(
    files: List[UploadFile] = File(...),
    target_format: str = Form("csv"),
):
    if len(files) < 2:
        raise HTTPException(400, "At least 2 files required for merge")
    results = []
    for f in files:
        data = f.file.read()
        results.append(dispatch_parser(data, f.filename or "unknown"))
    merged, warnings = merge_datasets(results)
    writer_fn, media_type, ext = WRITERS[target_format]
    output_bytes, write_warnings = writer_fn(merged)
    warnings.extend(write_warnings)
    # Return response...
```

### CRS Auto-Detection Heuristic
```python
def detect_crs_from_values(
    x_vals: list[float], y_vals: list[float]
) -> tuple[int | None, str]:
    """Detect CRS from coordinate value ranges.

    Returns (epsg_code_or_None, detection_note).
    """
    if not x_vals or not y_vals:
        return None, "No coordinate values found"

    x_min, x_max = min(x_vals), max(x_vals)
    y_min, y_max = min(y_vals), max(y_vals)

    # WGS84: lon [-180, 180], lat [-90, 90]
    if -180 <= x_min and x_max <= 180 and -90 <= y_min and y_max <= 90:
        return 4326, "Detected WGS84 (coordinates in degree range)"

    # OSGB36: easting [0, 700000], northing [0, 1300000]
    if 0 < x_min and x_max < 700_000 and 0 < y_min and y_max < 1_300_000:
        return 27700, "Detected OSGB36 British National Grid (easting/northing range)"

    # UTM: easting [100000, 900000], northing [0, 10000000]
    if 100_000 < x_min and x_max < 900_000 and 0 < y_min and y_max < 10_000_000:
        return None, "Likely UTM projection (zone unknown -- please select source CRS)"

    return None, "Could not detect CRS from coordinate ranges"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pyproj transform() function | Transformer.from_crs() class | pyproj 2.2+ (2019) | Old functional API deprecated; always use Transformer |
| Proj4 strings for CRS | EPSG codes or WKT2 | pyproj 3.0+ | Proj4 strings lose datum info; use EPSG codes |
| Manual UTM zone math | query_utm_crs_info() | pyproj 3.1+ | Handles Norway/Svalbard exceptions correctly |

**Deprecated/outdated:**
- `pyproj.transform()` function: Replaced by `Transformer.from_crs().transform()` -- do not use the old API
- PROJ4 string definitions: Use EPSG codes instead to avoid datum information loss

## Open Questions

1. **pyproj system dependencies on Railway**
   - What we know: pyproj requires the PROJ C library. pip wheels for Linux include bundled PROJ.
   - What's unclear: Whether Railway's Docker environment has issues with pyproj binary wheels.
   - Recommendation: Test `pip install pyproj` in the Railway build. If wheels fail, may need `apt-get install libproj-dev` in Dockerfile.

2. **Preview table reuse vs. new component**
   - What we know: Existing `data-preview-table.tsx` has column mapping UI tightly coupled (ColumnMapping types, survey column detection).
   - What's unclear: Whether it's cleaner to reuse with props or build a simpler read-only preview.
   - Recommendation: Build a lightweight read-only preview component (just headers + rows, no mapping UI). The existing component is too coupled to the dataset/mapping workflow.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0 |
| Config file | backend/pyproject.toml [tool.pytest.ini_options] |
| Quick run command | `cd backend && python -m pytest tests/transforms/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XFRM-01 | CRS conversion transforms coordinates correctly (WGS84 to UTM, UTM to OSGB36, etc.) | unit | `cd backend && python -m pytest tests/transforms/test_crs.py -x` | -- Wave 0 |
| XFRM-02 | CRS auto-detection returns correct EPSG for known coordinate ranges | unit | `cd backend && python -m pytest tests/transforms/test_detect_crs.py -x` | -- Wave 0 |
| XFRM-03 | Merge combines multiple ParseResults with column union | unit | `cd backend && python -m pytest tests/transforms/test_merge.py -x` | -- Wave 0 |
| XFRM-04 | Split by KP range produces correct subsets | unit | `cd backend && python -m pytest tests/transforms/test_split.py::test_split_by_kp -x` | -- Wave 0 |
| XFRM-05 | Split by column value produces one file per unique value | unit | `cd backend && python -m pytest tests/transforms/test_split.py::test_split_by_column -x` | -- Wave 0 |
| XFRM-06 | Transform endpoints return correct response format | unit | `cd backend && python -m pytest tests/test_transform_endpoint.py -x` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/transforms/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/transforms/__init__.py` -- package init
- [ ] `backend/tests/transforms/test_crs.py` -- CRS conversion tests
- [ ] `backend/tests/transforms/test_detect_crs.py` -- CRS detection heuristic tests
- [ ] `backend/tests/transforms/test_merge.py` -- merge logic tests
- [ ] `backend/tests/transforms/test_split.py` -- split by KP and column value tests
- [ ] `backend/tests/test_transform_endpoint.py` -- endpoint integration tests
- [ ] `backend/app/transforms/__init__.py` -- transforms package
- [ ] pyproj dependency: `pip install pyproj>=3.7`

## Sources

### Primary (HIGH confidence)
- [pyproj 3.7.2 Getting Started](https://pyproj4.github.io/pyproj/stable/examples.html) - Transformer usage, CRS creation
- [pyproj Transformer API](https://pyproj4.github.io/pyproj/stable/api/transformer.html) - always_xy parameter, from_crs method
- [pyproj CRS API](https://pyproj4.github.io/pyproj/stable/api/crs/crs.html) - CRS from EPSG codes
- [Python zipfile docs](https://docs.python.org/3/library/zipfile.html) - In-memory ZIP creation
- Existing codebase: `backend/app/routers/conversion.py`, `backend/app/writers/`, `src/app/api/convert/route.ts` -- established patterns

### Secondary (MEDIUM confidence)
- [pyproj query_utm_crs_info](https://pyproj4.github.io/pyproj/stable/api/proj.html) - UTM zone auto-detection via AreaOfInterest
- [pyproj PyPI](https://pypi.org/project/pyproj/) - Version 3.7.2, Python >=3.11

### Tertiary (LOW confidence)
- CRS auto-detection heuristics (coordinate range-based) -- custom approach, no standard library for this. Needs validation with real survey data.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pyproj is the definitive Python CRS library; zipfile is stdlib
- Architecture: HIGH - follows established converter pattern exactly; all reuse points verified in codebase
- Pitfalls: HIGH - pyproj axis order is well-documented; merge/split edge cases are straightforward
- CRS detection heuristic: MEDIUM - reasonable approach but needs real-world validation; OSGB36/UTM overlap is a known ambiguity

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, pyproj changes slowly)
