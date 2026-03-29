"""Base types and helpers shared across all format parsers."""

from dataclasses import dataclass, field


@dataclass
class ParseResult:
    """Normalized tabular output from any format parser."""

    headers: list[str]
    rows: list[list[str]]
    total_rows: int
    metadata: dict
    warnings: list[str] = field(default_factory=list)
    source_format: str = ""


def flatten_geometry(
    geometry_type: str, coordinates: list
) -> list[dict[str, str]]:
    """Convert GeoJSON-style geometry coordinates into flat row dicts.

    Returns a list of dicts, each with string values for longitude, latitude,
    and optionally elevation, point_index, ring.
    """
    rows: list[dict[str, str]] = []

    if geometry_type == "Point":
        row = _point_to_dict(coordinates)
        rows.append(row)

    elif geometry_type == "MultiPoint":
        for idx, point in enumerate(coordinates):
            row = _point_to_dict(point)
            row["point_index"] = str(idx)
            rows.append(row)

    elif geometry_type == "LineString":
        for idx, point in enumerate(coordinates):
            row = _point_to_dict(point)
            row["point_index"] = str(idx)
            rows.append(row)

    elif geometry_type == "MultiLineString":
        for line_idx, line in enumerate(coordinates):
            for pt_idx, point in enumerate(line):
                row = _point_to_dict(point)
                row["line_index"] = str(line_idx)
                row["point_index"] = str(pt_idx)
                rows.append(row)

    elif geometry_type == "Polygon":
        for ring_idx, ring in enumerate(coordinates):
            for pt_idx, point in enumerate(ring):
                row = _point_to_dict(point)
                row["ring"] = str(ring_idx)
                row["point_index"] = str(pt_idx)
                rows.append(row)

    elif geometry_type == "MultiPolygon":
        for poly_idx, polygon in enumerate(coordinates):
            for ring_idx, ring in enumerate(polygon):
                for pt_idx, point in enumerate(ring):
                    row = _point_to_dict(point)
                    row["polygon_index"] = str(poly_idx)
                    row["ring"] = str(ring_idx)
                    row["point_index"] = str(pt_idx)
                    rows.append(row)

    elif geometry_type == "GeometryCollection":
        # coordinates here is actually a list of geometry objects
        for geom in coordinates:
            sub_rows = flatten_geometry(geom["type"], geom["coordinates"])
            rows.extend(sub_rows)

    return rows


def _point_to_dict(coords: list) -> dict[str, str]:
    """Convert a coordinate array [lon, lat] or [lon, lat, elev] to a dict."""
    d: dict[str, str] = {
        "longitude": str(coords[0]),
        "latitude": str(coords[1]),
    }
    if len(coords) >= 3:
        d["elevation"] = str(coords[2])
    return d
