"""Segment continuity validator.

Checks consecutive rows maintain logical pipeline progression --
no teleports, backtracking, or impossible distances.
"""

import math

import pandas as pd
from app.validators.base import Severity, ValidationIssue


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


def _distance_m(
    x0: float, y0: float, x1: float, y1: float, coord_type: str,
) -> float:
    """Calculate approximate distance in meters between two points."""
    if coord_type == "geographic":
        dx = (x1 - x0) * 111_320
        dy = (y1 - y0) * 110_540
    else:
        dx = x1 - x0
        dy = y1 - y0
    return math.sqrt(dx * dx + dy * dy)


def check_segment_continuity(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
    max_segment_distance: float = 100.0,
    severity_override: str = "warning",
) -> list[ValidationIssue]:
    """Check that consecutive rows don't have impossible distance jumps.

    Args:
        df: Survey DataFrame.
        column_mappings: Column mapping dicts with mappedType.
        kp_column: Name of the KP column (used for backtracking detection).
        max_segment_distance: Maximum allowed distance in meters.
        severity_override: Severity level for flagged issues.

    Returns:
        List of ValidationIssue for segments exceeding max distance.
    """
    issues: list[ValidationIssue] = []

    x_col, y_col, coord_type = _find_coord_columns(column_mappings)
    if not x_col or not y_col or coord_type == "none":
        return issues
    if x_col not in df.columns or y_col not in df.columns:
        return issues

    severity = Severity(severity_override)

    x_vals = pd.to_numeric(df[x_col], errors="coerce")
    y_vals = pd.to_numeric(df[y_col], errors="coerce")

    kp_vals = None
    if kp_column and kp_column in df.columns:
        kp_vals = pd.to_numeric(df[kp_column], errors="coerce")

    for i in range(1, len(df)):
        x0, y0 = x_vals.iloc[i - 1], y_vals.iloc[i - 1]
        x1, y1 = x_vals.iloc[i], y_vals.iloc[i]

        if pd.isna(x0) or pd.isna(y0) or pd.isna(x1) or pd.isna(y1):
            continue

        dist = _distance_m(float(x0), float(y0), float(x1), float(y1), coord_type)

        if dist > max_segment_distance:
            # Check for KP backtracking
            backtracking = False
            kp_val = None
            if kp_vals is not None:
                kp0, kp1 = kp_vals.iloc[i - 1], kp_vals.iloc[i]
                if not pd.isna(kp0) and not pd.isna(kp1):
                    kp_val = float(kp1)
                    if float(kp1) < float(kp0):
                        backtracking = True

            msg = (
                f"Segment distance of {dist:.1f}m between rows {i} and {i + 1} "
                f"exceeds maximum ({max_segment_distance:.1f}m). "
                f"Possible data gap or coordinate error"
            )
            if backtracking:
                msg += " with KP backtracking"

            issues.append(ValidationIssue(
                row_number=i + 2,  # 1-based + header
                column_name=f"{x_col}/{y_col}",
                rule_type="segment_continuity",
                severity=severity,
                message=msg,
                expected=f"Distance <= {max_segment_distance:.1f}m",
                actual=f"{dist:.1f}m",
                kp_value=kp_val,
            ))

    return issues
