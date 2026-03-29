"""GeoJSON file parser -- converts GeoJSON to normalized tabular output."""

import json

from app.parsers.base import ParseResult, flatten_geometry


def parse_geojson(file_bytes: bytes) -> ParseResult:
    """Parse GeoJSON bytes into a ParseResult with string[][] rows.

    Handles both FeatureCollection and single Feature inputs.
    """
    data = json.loads(file_bytes)

    # Normalize to list of features
    if data.get("type") == "FeatureCollection":
        features = data.get("features", [])
    elif data.get("type") == "Feature":
        features = [data]
    else:
        raise ValueError(f"Unsupported GeoJSON type: {data.get('type')}")

    # Collect all property keys across features for consistent headers
    property_keys: set[str] = set()
    for feat in features:
        props = feat.get("properties") or {}
        property_keys.update(props.keys())
    sorted_prop_keys = sorted(property_keys)

    # Determine geometry columns needed
    # Always include geometry_type, longitude, latitude
    # Include elevation if any feature has 3D coords
    has_elevation = False
    has_point_index = False
    has_ring = False

    # Pre-scan geometry to determine which columns are needed
    for feat in features:
        geom = feat.get("geometry") or {}
        geom_type = geom.get("type", "")
        coords = geom.get("coordinates", [])
        sample_rows = flatten_geometry(geom_type, coords)
        for row in sample_rows:
            if "elevation" in row:
                has_elevation = True
            if "point_index" in row:
                has_point_index = True
            if "ring" in row:
                has_ring = True

    # Build headers
    headers = ["geometry_type", "longitude", "latitude"]
    if has_elevation:
        headers.append("elevation")
    if has_ring:
        headers.append("ring")
    if has_point_index:
        headers.append("point_index")
    headers.extend(sorted_prop_keys)

    # Build rows
    rows: list[list[str]] = []
    warnings: list[str] = []

    for feat in features:
        geom = feat.get("geometry") or {}
        geom_type = geom.get("type", "")
        coords = geom.get("coordinates", [])
        props = feat.get("properties") or {}

        geo_rows = flatten_geometry(geom_type, coords)

        if not geo_rows:
            warnings.append(f"Feature with no geometry skipped")
            continue

        for geo_row in geo_rows:
            row_values: list[str] = []
            for h in headers:
                if h == "geometry_type":
                    row_values.append(geom_type)
                elif h in geo_row:
                    row_values.append(geo_row[h])
                elif h in props:
                    row_values.append(str(props[h]))
                else:
                    row_values.append("")
            rows.append(row_values)

    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={"feature_count": len(features)},
        warnings=warnings,
        source_format="geojson",
    )
