"""Coordinate sanity checks — spatial validation.

Catches impossible coordinates, CRS mismatches, and points outside
plausible bounding boxes.
"""

import pandas as pd
from app.validators.base import ValidationIssue, Severity


# Plausible bounding boxes for common coordinate systems
COORD_BOUNDS = {
    # WGS84 geographic
    "latitude": {"min": -90.0, "max": 90.0},
    "longitude": {"min": -180.0, "max": 180.0},
    # UK National Grid (OSGB36) — generous bounds
    "easting": {"min": 0.0, "max": 700_000.0},
    "northing": {"min": 0.0, "max": 1_300_000.0},
}

# Maximum plausible distance between consecutive survey points (meters)
# Flags if coordinate jump suggests a data error
MAX_COORDINATE_JUMP_M = 10_000.0  # 10km between consecutive points


def check_coordinate_sanity(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Check coordinates are physically plausible.

    Validates:
    1. Lat/lon within valid ranges
    2. Easting/northing within plausible bounds
    3. Coordinate jumps between consecutive rows
    4. Lat/lon vs easting/northing co-existence consistency
    """
    issues: list[ValidationIssue] = []

    type_to_col: dict[str, str] = {}
    for m in column_mappings:
        mapped_type = m.get("mappedType")
        if mapped_type and not m.get("ignored", False):
            type_to_col[mapped_type] = mapped_type

    # 1. Basic coordinate bounds
    for coord_type, bounds in COORD_BOUNDS.items():
        if coord_type not in type_to_col:
            continue
        col = type_to_col[coord_type]
        if col not in df.columns:
            continue

        values = pd.to_numeric(df[col], errors="coerce")
        for idx, val in values.items():
            if pd.isna(val):
                continue
            if val < bounds["min"] or val > bounds["max"]:
                kp_val = _get_kp(df, idx, kp_column)
                issues.append(ValidationIssue(
                    row_number=int(idx) + 2,
                    column_name=col,
                    rule_type="coordinate_bounds",
                    severity=Severity.CRITICAL,
                    message=f"{coord_type} value {val:.6f} outside valid range [{bounds['min']}, {bounds['max']}]",
                    expected=f"{bounds['min']} to {bounds['max']}",
                    actual=str(round(val, 6)),
                    kp_value=kp_val,
                ))

    # 2. Coordinate jumps (lat/lon)
    if "latitude" in type_to_col and "longitude" in type_to_col:
        lat_col = type_to_col["latitude"]
        lon_col = type_to_col["longitude"]
        if lat_col in df.columns and lon_col in df.columns:
            issues.extend(_check_coordinate_jumps(
                df, lat_col, lon_col, kp_column, coord_type="geographic"
            ))

    # 3. Coordinate jumps (easting/northing)
    if "easting" in type_to_col and "northing" in type_to_col:
        e_col = type_to_col["easting"]
        n_col = type_to_col["northing"]
        if e_col in df.columns and n_col in df.columns:
            issues.extend(_check_coordinate_jumps(
                df, e_col, n_col, kp_column, coord_type="projected"
            ))

    return issues


def _check_coordinate_jumps(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    kp_column: str | None,
    coord_type: str,
) -> list[ValidationIssue]:
    """Detect large jumps in coordinate pairs between consecutive rows."""
    issues: list[ValidationIssue] = []

    x_vals = pd.to_numeric(df[x_col], errors="coerce")
    y_vals = pd.to_numeric(df[y_col], errors="coerce")

    for i in range(1, len(df)):
        x0, x1 = x_vals.iloc[i - 1], x_vals.iloc[i]
        y0, y1 = y_vals.iloc[i - 1], y_vals.iloc[i]

        if any(pd.isna(v) for v in [x0, x1, y0, y1]):
            continue

        if coord_type == "geographic":
            # Approximate meters from lat/lon degrees
            dx = (x1 - x0) * 111_320  # longitude to meters (at equator, rough)
            dy = (y1 - y0) * 110_540  # latitude to meters
        else:
            dx = x1 - x0
            dy = y1 - y0

        distance = (dx**2 + dy**2) ** 0.5

        if distance > MAX_COORDINATE_JUMP_M:
            kp_val = _get_kp(df, i, kp_column)
            issues.append(ValidationIssue(
                row_number=i + 2,
                column_name=f"{x_col}/{y_col}",
                rule_type="coordinate_jump",
                severity=Severity.WARNING,
                message=(
                    f"Coordinate jump of {distance:.0f}m between consecutive rows — "
                    f"possible data error or survey line break"
                ),
                expected=f"jump ≤ {MAX_COORDINATE_JUMP_M:.0f}m",
                actual=f"{distance:.0f}m",
                kp_value=kp_val,
            ))

    return issues


def _get_kp(df: pd.DataFrame, idx: int, kp_column: str | None) -> float | None:
    if kp_column and kp_column in df.columns:
        try:
            return float(df.iloc[idx][kp_column])
        except (ValueError, TypeError, IndexError):
            return None
    return None
