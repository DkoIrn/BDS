"""Position consistency checks — survey-specific validation.

Validates that coordinate positions are consistent with KP values:
KP-distance agreement, bearing continuity, and lateral deviation
from the survey line.
"""

import math

import pandas as pd
from app.validators.base import ValidationIssue, Severity


# KP-distance tolerance: allow coordinate distance to deviate by this
# factor from KP difference before flagging.
KP_DISTANCE_TOLERANCE = 3.0

# Minimum KP step to evaluate (skip near-zero KP increments)
MIN_KP_STEP = 0.001  # km

# Maximum bearing change (degrees) between consecutive segments
# before flagging as a potential data error
MAX_BEARING_CHANGE_DEG = 90.0

# Maximum lateral deviation from survey line (meters)
# Points further than this from the interpolated line are flagged
MAX_LATERAL_DEVIATION_M = 100.0

# Minimum segment length to evaluate bearing (meters)
MIN_SEGMENT_LENGTH_M = 1.0


def _find_coord_columns(
    column_mappings: list[dict],
) -> tuple[str | None, str | None, str]:
    """Find x/y coordinate columns. Returns (x_col, y_col, coord_type)."""
    type_to_col: dict[str, str] = {}
    for m in column_mappings:
        mapped_type = m.get("mappedType")
        if mapped_type and not m.get("ignored", False):
            type_to_col[mapped_type] = mapped_type

    if "easting" in type_to_col and "northing" in type_to_col:
        return type_to_col["easting"], type_to_col["northing"], "projected"
    if "latitude" in type_to_col and "longitude" in type_to_col:
        return type_to_col["latitude"], type_to_col["longitude"], "geographic"
    return None, None, "none"


def _get_kp(df: pd.DataFrame, idx: int, kp_column: str | None) -> float | None:
    if kp_column and kp_column in df.columns:
        try:
            return float(df.iloc[idx][kp_column])
        except (ValueError, TypeError, IndexError):
            return None
    return None


def _distance_m(
    x0: float, y0: float, x1: float, y1: float, coord_type: str
) -> float:
    """Calculate approximate distance in meters between two points."""
    if coord_type == "geographic":
        dx = (x1 - x0) * 111_320
        dy = (y1 - y0) * 110_540
    else:
        dx = x1 - x0
        dy = y1 - y0
    return math.sqrt(dx * dx + dy * dy)


def _bearing_deg(x0: float, y0: float, x1: float, y1: float) -> float:
    """Calculate bearing in degrees (0-360) from point 0 to point 1."""
    dx = x1 - x0
    dy = y1 - y0
    angle = math.degrees(math.atan2(dx, dy)) % 360
    return angle


def _bearing_change(b1: float, b2: float) -> float:
    """Smallest angle between two bearings (0-180)."""
    diff = abs(b2 - b1) % 360
    return min(diff, 360 - diff)


def _perpendicular_distance(
    px: float, py: float,
    ax: float, ay: float,
    bx: float, by: float,
) -> float:
    """Perpendicular distance from point P to line segment A-B (in coord units)."""
    abx = bx - ax
    aby = by - ay
    ab_len_sq = abx * abx + aby * aby

    if ab_len_sq < 1e-12:
        return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / ab_len_sq))
    proj_x = ax + t * abx
    proj_y = ay + t * aby
    return math.sqrt((px - proj_x) ** 2 + (py - proj_y) ** 2)


def check_position_consistency(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Run all position consistency checks.

    Checks:
    1. KP-distance agreement — KP increments should match coordinate distances
    2. Bearing continuity — sudden direction reversals flag data errors
    3. Lateral deviation — points far from the survey line
    """
    issues: list[ValidationIssue] = []

    x_col, y_col, coord_type = _find_coord_columns(column_mappings)
    if not x_col or not y_col or coord_type == "none":
        return issues
    if x_col not in df.columns or y_col not in df.columns:
        return issues

    x_vals = pd.to_numeric(df[x_col], errors="coerce")
    y_vals = pd.to_numeric(df[y_col], errors="coerce")

    kp_vals = None
    if kp_column and kp_column in df.columns:
        kp_vals = pd.to_numeric(df[kp_column], errors="coerce")

    # Build list of valid points (index, x, y, kp)
    points: list[tuple[int, float, float, float | None]] = []
    for i in range(len(df)):
        x, y = x_vals.iloc[i], y_vals.iloc[i]
        if pd.isna(x) or pd.isna(y):
            continue
        kp = None
        if kp_vals is not None and not pd.isna(kp_vals.iloc[i]):
            kp = float(kp_vals.iloc[i])
        points.append((i, float(x), float(y), kp))

    if len(points) < 2:
        return issues

    # 1. KP-distance agreement
    if kp_vals is not None:
        issues.extend(_check_kp_distance(
            points, coord_type, kp_column or "kp", x_col, y_col
        ))

    # 2. Bearing continuity
    issues.extend(_check_bearing_continuity(
        points, coord_type, x_col, y_col
    ))

    # 3. Lateral deviation from survey line
    issues.extend(_check_lateral_deviation(
        points, coord_type, x_col, y_col, kp_column
    ))

    return issues


def _check_kp_distance(
    points: list[tuple[int, float, float, float | None]],
    coord_type: str,
    kp_col_name: str,
    x_col: str,
    y_col: str,
) -> list[ValidationIssue]:
    """Check that KP increments are consistent with coordinate distances."""
    issues: list[ValidationIssue] = []

    for i in range(1, len(points)):
        idx0, x0, y0, kp0 = points[i - 1]
        idx1, x1, y1, kp1 = points[i]

        if kp0 is None or kp1 is None:
            continue

        kp_diff = abs(kp1 - kp0)
        if kp_diff < MIN_KP_STEP:
            continue

        coord_dist_m = _distance_m(x0, y0, x1, y1, coord_type)
        kp_dist_m = kp_diff * 1000  # KP is in km

        if kp_dist_m < 1.0:
            continue

        ratio = coord_dist_m / kp_dist_m

        if ratio > KP_DISTANCE_TOLERANCE or (ratio < 1.0 / KP_DISTANCE_TOLERANCE and coord_dist_m > MIN_SEGMENT_LENGTH_M):
            issues.append(ValidationIssue(
                row_number=idx1 + 2,
                column_name=f"{kp_col_name}/{x_col}",
                rule_type="kp_distance_mismatch",
                severity=Severity.WARNING,
                message=(
                    f"KP increment ({kp_diff:.3f} km = {kp_dist_m:.0f}m) "
                    f"inconsistent with coordinate distance ({coord_dist_m:.0f}m) "
                    f"— ratio {ratio:.1f}x"
                ),
                expected=f"Distance ≈ {kp_dist_m:.0f}m (from KP)",
                actual=f"{coord_dist_m:.0f}m (from coordinates)",
                kp_value=kp1,
            ))

    return issues


def _check_bearing_continuity(
    points: list[tuple[int, float, float, float | None]],
    coord_type: str,
    x_col: str,
    y_col: str,
) -> list[ValidationIssue]:
    """Detect sudden direction reversals in the survey line."""
    issues: list[ValidationIssue] = []

    if len(points) < 3:
        return issues

    bearings: list[tuple[int, float, float | None]] = []
    for i in range(1, len(points)):
        idx0, x0, y0, _ = points[i - 1]
        idx1, x1, y1, kp1 = points[i]

        dist = _distance_m(x0, y0, x1, y1, coord_type)
        if dist < MIN_SEGMENT_LENGTH_M:
            continue

        bearing = _bearing_deg(x0, y0, x1, y1)
        bearings.append((idx1, bearing, kp1))

    for i in range(1, len(bearings)):
        idx, b_curr, kp_val = bearings[i]
        _, b_prev, _ = bearings[i - 1]

        change = _bearing_change(b_prev, b_curr)
        if change > MAX_BEARING_CHANGE_DEG:
            issues.append(ValidationIssue(
                row_number=idx + 2,
                column_name=f"{x_col}/{y_col}",
                rule_type="bearing_discontinuity",
                severity=Severity.WARNING,
                message=(
                    f"Survey line bearing changes by {change:.0f}° "
                    f"(from {b_prev:.0f}° to {b_curr:.0f}°) "
                    f"— possible data error or unrecorded line break"
                ),
                expected=f"Bearing change ≤ {MAX_BEARING_CHANGE_DEG:.0f}°",
                actual=f"{change:.0f}°",
                kp_value=kp_val,
            ))

    return issues


def _check_lateral_deviation(
    points: list[tuple[int, float, float, float | None]],
    coord_type: str,
    x_col: str,
    y_col: str,
    kp_column: str | None,
) -> list[ValidationIssue]:
    """Flag points that deviate significantly from the survey line.

    Uses a sliding window: for each point, measures perpendicular distance
    to the line formed by its neighbors (prev → next).
    """
    issues: list[ValidationIssue] = []

    if len(points) < 3:
        return issues

    # Scale factor: convert coord units to approximate meters for comparison
    if coord_type == "geographic":
        scale_x = 111_320
        scale_y = 110_540
    else:
        scale_x = 1.0
        scale_y = 1.0

    for i in range(1, len(points) - 1):
        idx_prev, x_prev, y_prev, _ = points[i - 1]
        idx_curr, x_curr, y_curr, kp_curr = points[i]
        idx_next, x_next, y_next, _ = points[i + 1]

        # Scale to meters for distance calculation
        perp_dist = _perpendicular_distance(
            x_curr * scale_x, y_curr * scale_y,
            x_prev * scale_x, y_prev * scale_y,
            x_next * scale_x, y_next * scale_y,
        )

        if perp_dist > MAX_LATERAL_DEVIATION_M:
            issues.append(ValidationIssue(
                row_number=idx_curr + 2,
                column_name=f"{x_col}/{y_col}",
                rule_type="lateral_deviation",
                severity=Severity.WARNING,
                message=(
                    f"Position deviates {perp_dist:.0f}m from survey line "
                    f"— possible coordinate error or unrecorded route change"
                ),
                expected=f"Deviation ≤ {MAX_LATERAL_DEVIATION_M:.0f}m",
                actual=f"{perp_dist:.0f}m",
                kp_value=kp_curr,
            ))

    return issues
