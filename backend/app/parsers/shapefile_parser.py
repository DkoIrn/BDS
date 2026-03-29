"""Shapefile ZIP parser -- extracts attributes and coordinates from zipped shapefiles."""

import io
import zipfile

import shapefile

from app.parsers.base import ParseResult


def parse_shapefile_zip(file_bytes: bytes) -> ParseResult:
    """Parse a ZIP archive containing .shp/.dbf/.shx files into ParseResult.

    All row values are strings.
    """
    zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    names = zf.namelist()

    # Find the .shp file
    shp_name = None
    dbf_name = None
    shx_name = None
    for name in names:
        lower = name.lower()
        if lower.endswith(".shp"):
            shp_name = name
        elif lower.endswith(".dbf"):
            dbf_name = name
        elif lower.endswith(".shx"):
            shx_name = name

    if shp_name is None:
        raise ValueError("ZIP archive does not contain a .shp file")

    # Read component files
    shp_data = io.BytesIO(zf.read(shp_name))
    dbf_data = io.BytesIO(zf.read(dbf_name)) if dbf_name else None
    shx_data = io.BytesIO(zf.read(shx_name)) if shx_name else None

    # Check for .cpg encoding file
    encoding = "utf-8"
    for name in names:
        if name.lower().endswith(".cpg"):
            try:
                encoding = zf.read(name).decode("ascii").strip()
            except Exception:
                encoding = "utf-8"

    sf = shapefile.Reader(shp=shp_data, dbf=dbf_data, shx=shx_data, encoding=encoding)

    # Extract field names (skip DeletionFlag at index 0)
    field_names = [f[0] for f in sf.fields[1:]]

    # Build headers: attribute fields + coordinate columns
    headers = field_names + ["easting", "northing"]
    if sf.shapeTypeName in ("POINTZ", "POLYLINEZ", "POLYGONZ", "POINTM"):
        headers.append("elevation")

    rows: list[list[str]] = []
    shape_type = sf.shapeTypeName

    for sr in sf.iterShapeRecords():
        record_values = [str(v) if v is not None else "" for v in sr.record]
        points = sr.shape.points if sr.shape.points else []

        if not points:
            # Record with no geometry
            row = record_values + ["", ""]
            rows.append(row)
            continue

        for pt in points:
            row = list(record_values)
            row.append(str(pt[0]))  # easting / longitude
            row.append(str(pt[1]))  # northing / latitude
            if len(pt) >= 3 and "elevation" in headers:
                row.append(str(pt[2]))
            rows.append(row)

    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={
            "shape_type": shape_type,
            "record_count": len(sf),
        },
        warnings=[],
        source_format="shapefile",
    )
