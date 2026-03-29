"""Shared coordinate column detection constants and helpers for writers."""

LON_NAMES = {"longitude", "lon", "x", "easting", "long"}
LAT_NAMES = {"latitude", "lat", "y", "northing"}
ELEV_NAMES = {"elevation", "elev", "z", "height", "altitude"}


def find_column(headers: list[str], candidates: set[str]) -> int | None:
    """Return the index of the first header matching any candidate name (case-insensitive)."""
    for i, h in enumerate(headers):
        if h.strip().lower() in candidates:
            return i
    return None
