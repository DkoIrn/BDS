"""CRS auto-detection heuristics based on coordinate value ranges."""

from __future__ import annotations

from pyproj.database import query_utm_crs_info
from pyproj.aoi import AreaOfInterest


def detect_crs_from_values(
    x_vals: list[float], y_vals: list[float]
) -> tuple[int | None, str]:
    """Guess EPSG code from coordinate value ranges.

    Returns (epsg_code_or_None, human_readable_note).
    """
    if not x_vals or not y_vals:
        return None, "No coordinate values found"

    x_min, x_max = min(x_vals), max(x_vals)
    y_min, y_max = min(y_vals), max(y_vals)

    # WGS84: longitude [-180, 180], latitude [-90, 90]
    if -180 <= x_min and x_max <= 180 and -90 <= y_min and y_max <= 90:
        return 4326, "Detected WGS84 (longitude/latitude ranges)"

    # OSGB36 British National Grid: easting [0, 700000], northing [0, 1300000]
    if 0 <= x_min and x_max <= 700_000 and 0 <= y_min and y_max <= 1_300_000:
        return 27700, "Detected OSGB36 British National Grid"

    # UTM: easting [100000, 900000], northing [0, 10000000]
    if 100_000 <= x_min and x_max <= 900_000 and 0 <= y_min and y_max <= 10_000_000:
        return None, "Likely UTM projection but zone is ambiguous -- please specify source CRS"

    return None, "Could not determine CRS from coordinate ranges"


def utm_zone_from_lonlat(lon: float, lat: float) -> int:
    """Return the EPSG code for the UTM zone containing the given WGS84 point."""
    area = AreaOfInterest(
        west_lon_degree=lon,
        south_lat_degree=lat,
        east_lon_degree=lon,
        north_lat_degree=lat,
    )
    results = query_utm_crs_info(
        datum_name="WGS 84",
        area_of_interest=area,
    )
    if not results:
        raise ValueError(f"No UTM zone found for lon={lon}, lat={lat}")
    return int(results[0].code)
