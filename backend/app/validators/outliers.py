import numpy as np
import pandas as pd
from scipy.stats import zscore

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location


def check_outliers_zscore(
    df: pd.DataFrame,
    column: str,
    threshold: float = 3.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect statistical outliers using z-score method."""
    issues: list[ValidationIssue] = []
    series = pd.to_numeric(df[column], errors="coerce")
    valid = series.dropna()

    if len(valid) < 3 or float(valid.std()) == 0:
        return issues

    mean_val = float(valid.mean())
    std_val = float(valid.std())
    z_scores = zscore(valid)

    outlier_mask = np.abs(z_scores) > threshold
    outliers = valid[outlier_mask]

    for i, idx in enumerate(outliers.index):
        row_num = int(idx) + 1
        actual = float(series.iloc[series.index.get_loc(idx)])
        z = float(z_scores[valid.index.get_loc(idx)])
        kp = (
            float(df[kp_column].iloc[df.index.get_loc(idx)])
            if kp_column and kp_column in df.columns
            else None
        )

        location = format_location(kp, row_num)

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=column,
                rule_type="outlier_zscore",
                severity=Severity.WARNING,
                message=(
                    f"{location}: {column.upper()} value {actual}m is a statistical "
                    f"outlier (z-score: {z:.1f}, mean: {mean_val:.1f}m, "
                    f"std: {std_val:.1f}m). Values beyond +/-{threshold} sigma are flagged."
                ),
                expected=f"{mean_val - threshold * std_val:.1f} to {mean_val + threshold * std_val:.1f}",
                actual=str(actual),
                kp_value=kp,
            )
        )
    return issues


def check_outliers_iqr(
    df: pd.DataFrame,
    column: str,
    multiplier: float = 1.5,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect statistical outliers using IQR method."""
    issues: list[ValidationIssue] = []
    series = pd.to_numeric(df[column], errors="coerce")
    valid = series.dropna()

    if len(valid) < 3:
        return issues

    q1 = float(valid.quantile(0.25))
    q3 = float(valid.quantile(0.75))
    iqr = q3 - q1

    if iqr == 0:
        return issues

    lower_fence = q1 - multiplier * iqr
    upper_fence = q3 + multiplier * iqr

    outlier_mask = (valid < lower_fence) | (valid > upper_fence)
    outliers = valid[outlier_mask]

    for idx in outliers.index:
        row_num = int(idx) + 1
        actual = float(series.iloc[series.index.get_loc(idx)])
        kp = (
            float(df[kp_column].iloc[df.index.get_loc(idx)])
            if kp_column and kp_column in df.columns
            else None
        )

        location = format_location(kp, row_num)

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=column,
                rule_type="outlier_iqr",
                severity=Severity.WARNING,
                message=(
                    f"{location}: {column.upper()} value {actual}m is outside IQR fences "
                    f"(Q1: {q1:.1f}, Q3: {q3:.1f}, IQR: {iqr:.1f}, "
                    f"fences: [{lower_fence:.1f}, {upper_fence:.1f}])"
                ),
                expected=f"{lower_fence:.1f} to {upper_fence:.1f}",
                actual=str(actual),
                kp_value=kp,
            )
        )
    return issues
