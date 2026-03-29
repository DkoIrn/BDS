"""GeoJSON writer -- converts ParseResult to GeoJSON FeatureCollection bytes."""

import json

from app.parsers.base import ParseResult
from app.writers._coords import LON_NAMES, LAT_NAMES, ELEV_NAMES, find_column


def write_geojson(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert a ParseResult to GeoJSON FeatureCollection bytes.

    Returns:
        Tuple of (geojson_bytes, warnings).
    """
    warnings: list[str] = []
    lon_idx = find_column(result.headers, LON_NAMES)
    lat_idx = find_column(result.headers, LAT_NAMES)
    elev_idx = find_column(result.headers, ELEV_NAMES)

    has_coords = lon_idx is not None and lat_idx is not None
    if not has_coords:
        warnings.append("No coordinate columns found. Features will have null geometry.")

    # Determine which column indices are coordinate columns (to exclude from properties)
    coord_indices: set[int] = set()
    if lon_idx is not None:
        coord_indices.add(lon_idx)
    if lat_idx is not None:
        coord_indices.add(lat_idx)
    if elev_idx is not None:
        coord_indices.add(elev_idx)

    features: list[dict] = []
    skipped = 0

    for row in result.rows:
        # Build properties from non-coordinate columns
        properties: dict[str, str] = {}
        for i, header in enumerate(result.headers):
            if i not in coord_indices and i < len(row):
                properties[header] = row[i]

        if not has_coords:
            features.append({
                "type": "Feature",
                "geometry": None,
                "properties": properties,
            })
            continue

        # Try to parse coordinates
        try:
            lon = float(row[lon_idx])
            lat = float(row[lat_idx])
        except (ValueError, IndexError):
            skipped += 1
            continue

        coords: list[float] = [lon, lat]
        if elev_idx is not None:
            try:
                coords.append(float(row[elev_idx]))
            except (ValueError, IndexError):
                pass  # skip elevation, keep lon/lat

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": coords,
            },
            "properties": properties,
        })

    if skipped > 0:
        warnings.append(f"{skipped} row(s) skipped due to invalid coordinates.")

    fc = {
        "type": "FeatureCollection",
        "features": features,
    }
    return json.dumps(fc, indent=2).encode("utf-8"), warnings
