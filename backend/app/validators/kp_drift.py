"""Cumulative KP drift validator.

Detects when KP increments don't match actual coordinate distances,
flagging chainage errors that compound along the pipeline.
"""

import math

import pandas as pd
from app.validators.base import Severity, ValidationIssue


# Minimum coordinate distance to evaluate (avoids division by zero)
_EPSILON_M = 0.001  # km -> 1 meter


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


def _distance_km(
    x0: float, y0: float, x1: float, y1: float, coord_type: str,
) -> float:
    """Calculate approximate distance in km between two points."""
    if coord_type == "geographic":
        # Simple haversine approximation
        dx = (x1 - x0) * 111.320
        dy = (y1 - y0) * 110.540
    else:
        # Projected coordinates: units are meters, convert to km
        dx = (x1 - x0) / 1000.0
        dy = (y1 - y0) / 1000.0
    return math.sqrt(dx * dx + dy * dy)


def check_kp_drift(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
    kp_drift_tolerance: float = 0.01,
    severity_override: str = "warning",
) -> list[ValidationIssue]:
    """Check that KP increments match coordinate distances.

    Args:
        df: Survey DataFrame.
        column_mappings: Column mapping dicts with mappedType.
        kp_column: Name of the KP column.
        kp_drift_tolerance: Maximum allowed drift ratio (0.01 = 1%).
        severity_override: Severity level for flagged issues.

    Returns:
        List of ValidationIssue for rows where drift exceeds tolerance.
    """
    issues: list[ValidationIssue] = []

    x_col, y_col, coord_type = _find_coord_columns(column_mappings)
    if not x_col or not y_col or coord_type == "none":
        return issues
    if x_col not in df.columns or y_col not in df.columns:
        return issues
    if not kp_column or kp_column not in df.columns:
        return issues

    severity = Severity(severity_override)

    x_vals = pd.to_numeric(df[x_col], errors="coerce")
    y_vals = pd.to_numeric(df[y_col], errors="coerce")
    kp_vals = pd.to_numeric(df[kp_column], errors="coerce")

    for i in range(1, len(df)):
        x0, y0, kp0 = x_vals.iloc[i - 1], y_vals.iloc[i - 1], kp_vals.iloc[i - 1]
        x1, y1, kp1 = x_vals.iloc[i], y_vals.iloc[i], kp_vals.iloc[i]

        if pd.isna(x0) or pd.isna(y0) or pd.isna(x1) or pd.isna(y1):
            continue
        if pd.isna(kp0) or pd.isna(kp1):
            continue

        kp_increment = abs(float(kp1) - float(kp0))
        coord_dist = _distance_km(float(x0), float(y0), float(x1), float(y1), coord_type)

        # Guard: skip when computed distance is near zero
        if coord_dist < _EPSILON_M:
            continue

        drift = abs(kp_increment - coord_dist) / coord_dist

        if drift > kp_drift_tolerance:
            issues.append(ValidationIssue(
                row_number=i + 2,  # 1-based + header
                column_name=kp_column,
                rule_type="kp_drift",
                severity=severity,
                message=(
                    f"KP drift of {drift:.1%} between rows {i} and {i + 1} "
                    f"(tolerance: {kp_drift_tolerance:.1%}). "
                    f"KP increment: {kp_increment:.4f}km, "
                    f"coordinate distance: {coord_dist:.4f}km"
                ),
                expected=f"Drift <= {kp_drift_tolerance:.1%}",
                actual=f"{drift:.1%}",
                kp_value=float(kp1),
            ))

    return issues
