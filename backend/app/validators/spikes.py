"""Spike and gradient detection — continuity validation.

Detects abrupt row-to-row changes that indicate data entry errors,
sensor glitches, or file corruption. Different from outliers: a value
can be within normal range but still be a spike relative to neighbors.
"""

import pandas as pd
import numpy as np
from app.validators.base import ValidationIssue, Severity


# Default maximum gradient per KP unit for each column type.
# These represent physically plausible rates of change.
DEFAULT_GRADIENTS: dict[str, float] = {
    "dob": 10.0,       # 10m change per 1 KP (burial depth can vary over distance)
    "doc": 10.0,       # 10m per KP
    "depth": 50.0,     # 50m per KP (seabed can vary significantly)
    "top": 20.0,       # 20m per KP
    "elevation": 50.0, # 50m per KP
}

# For non-KP spike detection: maximum allowed change as multiple of
# the column's median absolute deviation (MAD)
DEFAULT_SPIKE_MAD_MULTIPLIER = 5.0


def _get_kp_value(df: pd.DataFrame, idx: int, kp_column: str | None) -> float | None:
    if kp_column and kp_column in df.columns:
        try:
            return float(df.iloc[idx][kp_column])
        except (ValueError, TypeError, IndexError):
            return None
    return None


def check_spikes(
    df: pd.DataFrame,
    column: str,
    kp_column: str | None = None,
    max_gradient: float | None = None,
    mad_multiplier: float = DEFAULT_SPIKE_MAD_MULTIPLIER,
) -> list[ValidationIssue]:
    """Detect spikes — abrupt row-to-row value changes.

    Two modes:
    1. KP-aware gradient: if KP column exists, computes value change per KP unit
       and flags rows exceeding max_gradient.
    2. MAD-based: if no KP column, uses median absolute deviation of row-to-row
       deltas to flag unusually large jumps.

    Args:
        df: DataFrame with data.
        column: Column name to check.
        kp_column: Optional KP column for gradient calculation.
        max_gradient: Maximum allowed change per KP unit. If None, uses defaults.
        mad_multiplier: Multiple of MAD to flag as spike (when no KP).
    """
    issues: list[ValidationIssue] = []

    if column not in df.columns:
        return issues

    values = pd.to_numeric(df[column], errors="coerce")
    if values.dropna().shape[0] < 3:
        return issues

    # Compute row-to-row deltas
    deltas = values.diff().abs()

    if kp_column and kp_column in df.columns:
        # KP-aware gradient mode
        kp_values = pd.to_numeric(df[kp_column], errors="coerce")
        kp_deltas = kp_values.diff().abs()

        gradient = max_gradient
        if gradient is None:
            # Try to find a default for this column type
            col_lower = column.lower()
            gradient = DEFAULT_GRADIENTS.get(col_lower, None)

        if gradient is None:
            # Fall back to MAD-based detection
            return _check_spikes_mad(df, column, values, deltas, kp_column, mad_multiplier)

        for i in range(1, len(df)):
            if pd.isna(deltas.iloc[i]) or pd.isna(kp_deltas.iloc[i]):
                continue

            kp_delta = kp_deltas.iloc[i]
            if kp_delta <= 0:
                continue

            actual_gradient = deltas.iloc[i] / kp_delta

            if actual_gradient > gradient:
                kp_val = _get_kp_value(df, i, kp_column)
                issues.append(ValidationIssue(
                    row_number=i + 2,  # 1-indexed + header
                    column_name=column,
                    rule_type="spike_gradient",
                    severity=Severity.WARNING,
                    message=(
                        f"{column} changes by {deltas.iloc[i]:.3f} over {kp_delta:.4f} KP "
                        f"(gradient {actual_gradient:.1f}/KP) — exceeds expected rate of {gradient}/KP"
                    ),
                    expected=f"gradient ≤ {gradient}/KP",
                    actual=f"{actual_gradient:.1f}/KP",
                    kp_value=kp_val,
                ))
    else:
        # No KP — use MAD-based detection
        issues = _check_spikes_mad(df, column, values, deltas, kp_column, mad_multiplier)

    return issues


def _check_spikes_mad(
    df: pd.DataFrame,
    column: str,
    values: pd.Series,
    deltas: pd.Series,
    kp_column: str | None,
    mad_multiplier: float,
) -> list[ValidationIssue]:
    """Detect spikes using Median Absolute Deviation of row-to-row deltas."""
    issues: list[ValidationIssue] = []

    clean_deltas = deltas.dropna()
    if clean_deltas.shape[0] < 3:
        return issues

    median_delta = clean_deltas.median()
    mad = (clean_deltas - median_delta).abs().median()

    if mad == 0:
        # All deltas identical — use a fraction of the median as threshold
        threshold = median_delta * 3.0 if median_delta > 0 else 0
    else:
        threshold = median_delta + (mad_multiplier * mad)

    if threshold == 0:
        return issues

    for i in range(1, len(df)):
        if pd.isna(deltas.iloc[i]):
            continue

        if deltas.iloc[i] > threshold:
            kp_val = _get_kp_value(df, i, kp_column)
            issues.append(ValidationIssue(
                row_number=i + 2,
                column_name=column,
                rule_type="spike_detection",
                severity=Severity.WARNING,
                message=(
                    f"{column} changes abruptly by {deltas.iloc[i]:.3f} between consecutive rows "
                    f"(threshold: {threshold:.3f})"
                ),
                expected=f"change ≤ {threshold:.3f}",
                actual=f"{deltas.iloc[i]:.3f}",
                kp_value=kp_val,
            ))

    return issues
