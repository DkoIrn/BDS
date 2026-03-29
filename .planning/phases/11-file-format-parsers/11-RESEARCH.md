# Phase 11: File Format Parsers - Research

**Researched:** 2026-03-29
**Domain:** Geospatial file parsing (GeoJSON, Shapefile, KML/KMZ, LandXML, DXF)
**Confidence:** HIGH

## Summary

Phase 11 adds support for five geospatial file formats beyond the existing CSV/Excel parsers. The key architectural decision is whether to use the heavy GDAL/geopandas stack or lightweight per-format libraries. Given the project already runs on `python:3.12-slim` Docker on Railway and deliberately avoids heavy C dependencies (the Supabase SDK was replaced with httpx for this reason), the recommended approach is **lightweight per-format Python libraries** that install cleanly via pip with no system-level GDAL dependency.

The parsing should happen on the **FastAPI backend** (not the Next.js frontend) because these formats require Python libraries with no JavaScript equivalents, and the backend already handles file downloads from Supabase Storage. The output from each parser must be a normalized tabular structure (rows of coordinate/attribute data as `string[][]`) that feeds into the existing column detection, mapping, and validation pipeline.

**Primary recommendation:** Use pyshp (Shapefile), ezdxf (DXF), fastkml (KML/KMZ), and lxml (LandXML) as individual lightweight parsers on the FastAPI backend. GeoJSON needs only the stdlib `json` module. Route new formats through a new `/api/v1/parse` endpoint that returns the same tabular output as the existing Next.js `/api/parse` route.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FMT-01 | System can parse GeoJSON files and extract features as tabular rows | json stdlib + geometry flattening pattern |
| FMT-02 | System can parse Shapefile archives (.zip containing .shp/.dbf/.shx) and extract attributes/coordinates | pyshp (pure Python, no GDAL) |
| FMT-03 | System can parse KML and KMZ files and extract placemarks as tabular rows | fastkml + stdlib zipfile for KMZ decompression |
| FMT-04 | System can parse LandXML files and extract alignment/surface data as tabular rows | lxml with XPath queries against LandXML schema |
| FMT-05 | System can parse DXF files and extract entity coordinates/attributes as tabular rows | ezdxf with entity iteration |
| FMT-06 | All parsed formats produce output compatible with existing column detection and validation pipeline | Normalized string[][] output + ParsedMetadata |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pyshp | >=2.3 | Shapefile reading | Pure Python, no GDAL, reads .shp/.dbf/.shx directly |
| ezdxf | >=1.4 | DXF reading | Pure Python core (optional C extensions), comprehensive DXF support |
| fastkml | >=1.0 | KML/KMZ parsing | Pure Python, uses lxml for speed, handles KML schema well |
| lxml | >=5.0 | XML parsing (LandXML + KML backend) | Fast C-backed XML parser, XPath support, binary wheels available |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (stdlib) | - | GeoJSON parsing | Always -- GeoJSON is just JSON |
| zipfile (stdlib) | - | KMZ/Shapefile ZIP extraction | When handling .kmz or .zip shapefile archives |
| shapely | >=2.0 | Geometry WKT/coordinate extraction | Optional -- only if geometry simplification needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pyshp | geopandas+fiona | Full GDAL stack required; 500MB+ Docker image increase; overkill for extraction |
| fastkml | fiona KML driver | Requires GDAL with KML driver; not reliably in pip wheels |
| ezdxf | OGR DXF driver | Requires GDAL; ezdxf is more comprehensive for DXF entities |
| lxml (LandXML) | xml.etree.ElementTree | stdlib alternative but slower; lxml XPath is much faster for large files |
| Per-format libs | geopandas for all | GDAL pip wheels may not include KML/DXF drivers; conda-forge needed; heavy for Docker |

**Installation (add to backend/requirements.txt):**
```bash
pyshp>=2.3
ezdxf>=1.4
fastkml>=1.0
lxml>=5.0
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── parsers/
│   │   ├── __init__.py         # Registry + dispatch
│   │   ├── base.py             # ParseResult dataclass, abstract interface
│   │   ├── geojson_parser.py   # GeoJSON → tabular
│   │   ├── shapefile_parser.py # Shapefile ZIP → tabular
│   │   ├── kml_parser.py       # KML/KMZ → tabular
│   │   ├── landxml_parser.py   # LandXML → tabular
│   │   └── dxf_parser.py       # DXF → tabular
│   ├── routers/
│   │   └── parsing.py          # /api/v1/parse endpoint
│   └── ...
├── tests/
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── test_geojson_parser.py
│   │   ├── test_shapefile_parser.py
│   │   ├── test_kml_parser.py
│   │   ├── test_landxml_parser.py
│   │   └── test_dxf_parser.py
│   └── fixtures/
│       ├── sample.geojson
│       ├── sample.zip           # shapefile archive
│       ├── sample.kml
│       ├── sample.kmz
│       ├── sample.xml           # LandXML
│       └── sample.dxf
└── ...
```

### Pattern 1: Unified ParseResult Output
**What:** Every parser returns the same ParseResult structure regardless of input format
**When to use:** Always -- this is the core integration pattern

```python
from dataclasses import dataclass, field

@dataclass
class ParseResult:
    """Normalized output from any geospatial parser."""
    headers: list[str]                    # Column names (e.g., ["easting", "northing", "depth", "description"])
    rows: list[list[str]]                 # All values as strings (matches existing string[][] pattern)
    total_rows: int                       # Row count
    metadata: dict                        # Format-specific metadata (CRS, layer names, etc.)
    warnings: list[str] = field(default_factory=list)  # Parse warnings
    source_format: str = ""               # "geojson", "shapefile", "kml", "landxml", "dxf"
```

### Pattern 2: Format Dispatch by Extension + MIME
**What:** Route files to the correct parser based on extension/MIME, same pattern as existing parse route
**When to use:** In the parse endpoint

```python
PARSER_REGISTRY = {
    ".geojson": parse_geojson,
    ".json": parse_geojson,       # GeoJSON often has .json extension
    ".zip": parse_shapefile_zip,  # Shapefile archives
    ".shp": parse_shapefile_zip,  # Single .shp (needs companion files)
    ".kml": parse_kml,
    ".kmz": parse_kmz,
    ".xml": parse_landxml,        # LandXML
    ".dxf": parse_dxf,
}

def dispatch_parser(file_bytes: bytes, filename: str) -> ParseResult:
    ext = Path(filename).suffix.lower()
    parser = PARSER_REGISTRY.get(ext)
    if not parser:
        raise ValueError(f"Unsupported format: {ext}")
    return parser(file_bytes)
```

### Pattern 3: Geometry Flattening to Columns
**What:** Convert geometry objects to easting/northing/elevation columns
**When to use:** For all geospatial formats -- geometry must become tabular columns

```python
def flatten_geometry(geom_type: str, coords) -> list[dict]:
    """Convert geometry coordinates to flat row dicts."""
    rows = []
    if geom_type == "Point":
        rows.append({"longitude": str(coords[0]), "latitude": str(coords[1]),
                      "elevation": str(coords[2]) if len(coords) > 2 else ""})
    elif geom_type == "LineString":
        for i, coord in enumerate(coords):
            rows.append({"point_index": str(i), "longitude": str(coord[0]),
                          "latitude": str(coord[1]),
                          "elevation": str(coord[2]) if len(coord) > 2 else ""})
    elif geom_type == "Polygon":
        for ring_idx, ring in enumerate(coords):
            for pt_idx, coord in enumerate(ring):
                rows.append({"ring": str(ring_idx), "point_index": str(pt_idx),
                              "longitude": str(coord[0]), "latitude": str(coord[1])})
    return rows
```

### Pattern 4: Shapefile as ZIP Upload
**What:** Shapefiles consist of multiple mandatory files (.shp, .dbf, .shx). Users upload a .zip containing all components.
**When to use:** Always for shapefiles -- single .shp upload is insufficient

```python
import zipfile
import io
import shapefile  # pyshp

def parse_shapefile_zip(file_bytes: bytes) -> ParseResult:
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        # Find the .shp file inside the ZIP
        shp_names = [n for n in zf.namelist() if n.lower().endswith(".shp")]
        if not shp_names:
            raise ValueError("No .shp file found in ZIP archive")

        # pyshp can read from file-like objects
        shp_name = shp_names[0]
        base = shp_name[:-4]  # strip .shp

        shp_data = io.BytesIO(zf.read(f"{base}.shp"))
        dbf_data = io.BytesIO(zf.read(f"{base}.dbf"))
        shx_data = io.BytesIO(zf.read(f"{base}.shx"))

        sf = shapefile.Reader(shp=shp_data, dbf=dbf_data, shx=shx_data)
        # ... extract fields and records
```

### Anti-Patterns to Avoid
- **Installing GDAL system packages in Docker:** Adds 500MB+, complex build, fragile driver configuration. Use per-format pure-Python libraries instead.
- **Parsing on the Next.js frontend:** These formats need Python libraries; JavaScript equivalents are incomplete or nonexistent for LandXML/DXF.
- **Returning geometry objects:** The downstream pipeline expects `string[][]`. Always flatten to tabular form.
- **Ignoring CRS metadata:** Extract and store CRS info in metadata even though coordinate transforms are out of scope.
- **Requiring .shp files individually:** Always require ZIP upload for shapefiles to ensure companion files are present.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DXF entity parsing | Custom DXF text parser | ezdxf | DXF format has 30+ entity types, complex block references, hundreds of group codes |
| Shapefile binary format | Custom .shp/.dbf reader | pyshp | Binary format with variable-length records, encoding issues, null shape handling |
| KML XML schema | Custom XML walker | fastkml | KML has nested folders, styles, multi-geometry, extended data, namespaces |
| LandXML alignment math | Custom spiral/curve calculator | lxml XPath + math | Alignment geometry involves clothoid spirals, compound curves, vertical profiles |
| KMZ decompression | Custom zip handler | stdlib zipfile | KMZ is a standard ZIP; zipfile handles it correctly |
| GeoJSON validation | Custom schema checker | json stdlib | GeoJSON is well-specified JSON; stdlib json + type checking is sufficient |
| Geometry coordinate extraction | Custom nested loop per format | Unified flatten_geometry helper | Same coordinate pattern across all formats; DRY it |

**Key insight:** Each geospatial format has deep complexity (encoding variants, optional fields, edge cases in geometry types). The libraries handle decades of format evolution. Custom parsers will break on real-world files.

## Common Pitfalls

### Pitfall 1: Shapefile Encoding Issues
**What goes wrong:** Attribute text appears as garbled characters
**Why it happens:** .dbf files use various encodings (Latin-1, UTF-8, Shift-JIS). The .cpg file specifies encoding but may be missing.
**How to avoid:** pyshp's Reader accepts an `encoding` parameter. Try UTF-8 first, fall back to Latin-1. Check for .cpg file in the ZIP.
**Warning signs:** Non-ASCII characters in attribute values look wrong

### Pitfall 2: Mixed Geometry Types in One File
**What goes wrong:** A GeoJSON FeatureCollection contains Points, Lines, and Polygons mixed together
**Why it happens:** GeoJSON spec allows mixed geometry types in a single collection
**How to avoid:** Flatten each geometry type to rows independently. Include a "geometry_type" column so users can filter. Handle GeometryCollection by recursing into sub-geometries.
**Warning signs:** Row counts don't match feature counts (multi-geometries expand to multiple rows)

### Pitfall 3: KML Namespace Handling
**What goes wrong:** XPath queries return empty results on valid KML files
**Why it happens:** KML uses XML namespaces (`http://www.opengis.net/kml/2.2`). Queries without namespace awareness fail silently.
**How to avoid:** fastkml handles namespaces internally. If using raw lxml, always register namespaces in XPath queries.
**Warning signs:** Parser returns zero features from a file that visibly contains data

### Pitfall 4: DXF Block References vs Raw Entities
**What goes wrong:** Parser misses entities that are visually present in the drawing
**Why it happens:** DXF uses INSERT entities (block references) that expand to multiple sub-entities. Modelspace may reference blocks.
**How to avoid:** Use ezdxf's `modelspace()` to iterate entities. For INSERT entities, use `virtual_entities()` to expand block references.
**Warning signs:** Entity count is much lower than expected

### Pitfall 5: LandXML Multiple Data Types
**What goes wrong:** Parser only handles alignments but file contains surfaces, parcels, and pipe networks
**Why it happens:** LandXML is a broad schema covering many civil engineering data types
**How to avoid:** Detect top-level elements first (Alignments, Surfaces, CgPoints, PipeNetworks). Parse each type separately. Return multiple tables or let user pick which data to extract.
**Warning signs:** Users report "missing data" when file contains non-alignment elements

### Pitfall 6: Large File Memory Usage
**What goes wrong:** Backend OOMs on large DXF or Shapefile uploads
**Why it happens:** ezdxf loads entire DXF into memory; large shapefiles can have millions of records
**How to avoid:** Set reasonable row limits (e.g., 100K rows for preview). Stream shapefile records rather than loading all at once. Log file sizes and set a max (50MB already enforced by upload).
**Warning signs:** Railway container restarts with OOM errors

### Pitfall 7: Frontend MIME Type Detection
**What goes wrong:** New file types get rejected by the upload component or parse route
**Why it happens:** The current ACCEPTED_FILE_TYPES map only includes CSV/Excel MIME types. react-dropzone and the parse route filter by MIME type.
**How to avoid:** Add new MIME types and extensions to ACCEPTED_FILE_TYPES. Update the parse route's format detection logic. Many geospatial formats use generic MIME types (application/octet-stream, application/xml).
**Warning signs:** Users can't upload .geojson or .dxf files

## Code Examples

### GeoJSON Parser
```python
# Source: stdlib json + GeoJSON spec (https://geojson.org/)
import json

def parse_geojson(file_bytes: bytes) -> ParseResult:
    data = json.loads(file_bytes.decode("utf-8"))

    # Handle both FeatureCollection and single Feature
    if data.get("type") == "FeatureCollection":
        features = data.get("features", [])
    elif data.get("type") == "Feature":
        features = [data]
    else:
        raise ValueError(f"Unsupported GeoJSON type: {data.get('type')}")

    # Collect all property keys across features
    all_keys: set[str] = set()
    for f in features:
        all_keys.update(f.get("properties", {}).keys())

    # Build headers: geometry columns + property columns
    headers = ["geometry_type", "longitude", "latitude", "elevation"] + sorted(all_keys)

    rows = []
    for feature in features:
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        geom_type = geom.get("type", "")
        coords = geom.get("coordinates", [])

        flat_points = flatten_geometry(geom_type, coords)
        for pt in flat_points:
            row = [
                geom_type,
                pt.get("longitude", ""),
                pt.get("latitude", ""),
                pt.get("elevation", ""),
            ] + [str(props.get(k, "")) for k in sorted(all_keys)]
            rows.append(row)

    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={"feature_count": len(features), "crs": data.get("crs")},
        source_format="geojson",
    )
```

### KML/KMZ Parser
```python
# Source: fastkml docs (https://fastkml.readthedocs.io/)
import zipfile
import io
from fastkml import KML

def parse_kmz(file_bytes: bytes) -> ParseResult:
    """Extract KML from KMZ archive, then parse."""
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
        if not kml_names:
            raise ValueError("No .kml file found in KMZ archive")
        kml_bytes = zf.read(kml_names[0])
    return parse_kml(kml_bytes)

def parse_kml(file_bytes: bytes) -> ParseResult:
    """Parse KML file and extract placemarks as tabular rows."""
    kml = KML()
    kml.from_string(file_bytes)

    placemarks = list(kml.find_all(kml.Placemark))
    # ... iterate placemarks, extract name, description, geometry, extended data
```

### DXF Parser
```python
# Source: ezdxf docs (https://ezdxf.readthedocs.io/en/stable/tutorials/getting_data.html)
import ezdxf
import io

def parse_dxf(file_bytes: bytes) -> ParseResult:
    doc = ezdxf.read(io.BytesIO(file_bytes))
    msp = doc.modelspace()

    headers = ["entity_type", "layer", "easting", "northing", "elevation"]
    rows = []

    for entity in msp:
        etype = entity.dxftype()
        layer = entity.dxf.layer

        if etype == "POINT":
            pt = entity.dxf.location
            rows.append([etype, layer, str(pt.x), str(pt.y), str(pt.z)])
        elif etype == "LINE":
            start = entity.dxf.start
            end = entity.dxf.end
            rows.append([etype, layer, str(start.x), str(start.y), str(start.z)])
            rows.append([etype, layer, str(end.x), str(end.y), str(end.z)])
        elif etype == "LWPOLYLINE":
            for pt in entity.get_points(format="xyb"):
                rows.append([etype, layer, str(pt[0]), str(pt[1]), "0"])
        elif etype == "INSERT":
            # Expand block references
            for sub in entity.virtual_entities():
                # Recursively process sub-entities
                pass

    return ParseResult(headers=headers, rows=rows, total_rows=len(rows),
                       metadata={"layers": list(doc.layers)}, source_format="dxf")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GDAL/OGR for everything | Per-format lightweight libs | 2023+ (pyshp matured, ezdxf 1.x) | No GDAL system dependency needed |
| fiona for shapefile I/O | pyshp for pure-Python reading | pyshp 2.x (2020+) | Simpler install, adequate for read-only |
| xml.etree for KML | fastkml 1.x | 2024 (fastkml rewrite) | Proper KML object model vs raw XML |
| geopandas.read_file for all | Format-specific parsers | N/A | Avoids 500MB+ Docker bloat for extraction-only use case |

**Deprecated/outdated:**
- fiona.drvsupport.supported_drivers hack for KML: Old pattern of manually enabling KML driver in fiona. Use fastkml instead.
- pyogrio pip wheels for KML/DXF: Not reliably included in pip binary wheels. Only guaranteed via conda-forge.

## Integration Points with Existing System

### Parse Route Architecture
The existing parse route is in Next.js (`/api/parse`). New format parsing should go through a **new FastAPI endpoint** (`/api/v1/parse`) because:
1. Python libraries (pyshp, ezdxf, fastkml) have no JS equivalents
2. Backend already downloads files from Supabase Storage
3. Pattern matches validation route (Next.js proxy -> FastAPI)

The Next.js `/api/parse` route should be updated to proxy new formats to FastAPI, similar to how `/api/validate` proxies to FastAPI.

### Upload Component Changes
- Update `ACCEPTED_FILE_TYPES` in `src/lib/types/files.ts` to include new MIME types/extensions
- Update react-dropzone accept prop
- Update parse route MIME detection

### Column Detection Compatibility
The existing `detectColumns()` function works on `string[][]` with header names. New parsers produce headers like "easting", "northing", "latitude", "longitude" which already match `SurveyColumnType`. Column detection confidence will be HIGH for these since header names match exactly.

### Validation Pipeline Compatibility
The FastAPI validation router already reads DataFrames. New parsed data stored in the same dataset table format will flow through validation without changes.

## Open Questions

1. **Multi-layer files**
   - What we know: KML files can have nested folders/layers, Shapefiles have one layer, DXF has layers
   - What's unclear: Should we present all layers as one flat table, or let users pick a layer?
   - Recommendation: Start with flattening all layers into one table with a "layer" column. Add layer selection UI later if needed.

2. **Coordinate Reference System (CRS)**
   - What we know: Some formats embed CRS info (.prj in shapefiles, srsName in KML)
   - What's unclear: Should we store/display CRS info? Transform to WGS84?
   - Recommendation: Extract and store CRS in metadata. Do NOT transform (out of scope per REQUIREMENTS.md). Display CRS info in the UI so users know what coordinate system data is in.

3. **LandXML scope**
   - What we know: LandXML can contain alignments, surfaces, parcels, pipe networks, cross-sections
   - What's unclear: Which elements are most relevant for pipeline/seabed survey QC?
   - Recommendation: Start with CgPoints (survey points) and Alignments (pipeline centerline). Surface TINs and pipe networks are lower priority.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 8.0 |
| Config file | backend/tests/ (existing conftest.py) |
| Quick run command | `cd backend && python -m pytest tests/parsers/ -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FMT-01 | GeoJSON FeatureCollection parsed to rows | unit | `pytest tests/parsers/test_geojson_parser.py -x` | Wave 0 |
| FMT-02 | Shapefile ZIP parsed to rows with attributes | unit | `pytest tests/parsers/test_shapefile_parser.py -x` | Wave 0 |
| FMT-03 | KML placemarks + KMZ decompression parsed | unit | `pytest tests/parsers/test_kml_parser.py -x` | Wave 0 |
| FMT-04 | LandXML CgPoints/Alignments parsed | unit | `pytest tests/parsers/test_landxml_parser.py -x` | Wave 0 |
| FMT-05 | DXF entities parsed to coordinate rows | unit | `pytest tests/parsers/test_dxf_parser.py -x` | Wave 0 |
| FMT-06 | All parsers return consistent ParseResult | unit | `pytest tests/parsers/test_parse_dispatch.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/parsers/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/parsers/__init__.py` -- package init
- [ ] `backend/tests/parsers/test_geojson_parser.py` -- GeoJSON tests
- [ ] `backend/tests/parsers/test_shapefile_parser.py` -- Shapefile tests
- [ ] `backend/tests/parsers/test_kml_parser.py` -- KML/KMZ tests
- [ ] `backend/tests/parsers/test_landxml_parser.py` -- LandXML tests
- [ ] `backend/tests/parsers/test_dxf_parser.py` -- DXF tests
- [ ] `backend/tests/parsers/test_parse_dispatch.py` -- Dispatch + ParseResult tests
- [ ] `backend/tests/fixtures/` -- Sample files for each format
- [ ] `backend/app/parsers/__init__.py` -- Parser package

## Sources

### Primary (HIGH confidence)
- [ezdxf official docs](https://ezdxf.readthedocs.io/en/stable/) - DXF entity types, coordinate extraction, version 1.4.3
- [pyshp GitHub](https://github.com/GeospatialPython/pyshp) - Pure Python shapefile reading, Reader API
- [fastkml docs](https://fastkml.readthedocs.io/) - KML parsing, Placemark iteration, version 1.5.0dev
- [GeoJSON spec](https://geojson.org/) - Feature/FeatureCollection structure
- [Python lxml](https://lxml.de/) - XML/XPath for LandXML parsing
- [pyogrio supported formats](https://pyogrio.readthedocs.io/en/latest/supported_formats.html) - Verified KML/DXF not reliably in pip wheels

### Secondary (MEDIUM confidence)
- [GeoPandas I/O docs](https://geopandas.org/en/stable/docs/user_guide/io.html) - Verified geopandas read_file patterns
- [pyogrio install docs](https://pyogrio.readthedocs.io/en/latest/install.html) - Wheel driver limitations confirmed

### Tertiary (LOW confidence)
- [mac999/landxml_parser](https://github.com/mac999/landxml_parser) - Reference for LandXML element structure (small project, unverified quality)
- [LandXML blog post](https://lixcode121.blogspot.com/2010/05/python-and-xml-landxml.html) - Old but shows element structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pyshp, ezdxf, fastkml, lxml are all well-established with pip wheels
- Architecture: HIGH - Follows existing project patterns (FastAPI backend, proxy from Next.js, string[][] output)
- Pitfalls: MEDIUM - Based on domain knowledge and documentation; real-world edge cases may surface
- LandXML parsing: LOW - No mature dedicated library; requires custom XPath queries

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable libraries, 30 days)
