import pandas as pd

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location


def check_missing_data(
    df: pd.DataFrame,
    column: str,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect null, NaN, and empty string values in a column."""
    issues: list[ValidationIssue] = []
    null_mask = df[column].isna() | (df[column].astype(str).str.strip() == "")

    for idx in df[null_mask].index:
        row_num = int(idx) + 1
        kp = None
        if kp_column and kp_column in df.columns and pd.notna(df[kp_column].iloc[df.index.get_loc(idx)]):
            kp = float(df[kp_column].iloc[df.index.get_loc(idx)])

        location = format_location(kp, row_num)

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=column,
                rule_type="missing_data",
                severity=Severity.INFO,
                message=f"{location}: {column.upper()} value is missing or empty",
                expected="Non-null value",
                actual="NULL",
                kp_value=kp,
            )
        )
    return issues


def check_kp_gaps(
    df: pd.DataFrame,
    kp_column: str,
    max_gap: float | None = None,
) -> list[ValidationIssue]:
    """Detect gaps in KP coverage that exceed the threshold.

    If max_gap is not provided, uses median(diff) * 3 as dynamic threshold.
    """
    issues: list[ValidationIssue] = []
    kp = pd.to_numeric(df[kp_column], errors="coerce").dropna()
    if len(kp) < 2:
        return issues

    kp_sorted = kp.sort_values().reset_index(drop=True)
    gaps = kp_sorted.diff()

    # Dynamic threshold: median spacing * 3
    if max_gap is None:
        median_gap = float(gaps.dropna().median())
        max_gap = median_gap * 3

    large_gaps = gaps[gaps > max_gap]

    for pos in large_gaps.index:
        row_num = int(pos) + 1
        gap_size = float(gaps.iloc[pos])
        kp_val = float(kp_sorted.iloc[pos])
        prev_kp = float(kp_sorted.iloc[pos - 1]) if pos > 0 else None

        prev_str = f"KP {prev_kp:.3f}" if prev_kp is not None else "start"

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=kp_column,
                rule_type="kp_gap",
                severity=Severity.WARNING,
                message=(
                    f"KP coverage gap of {gap_size:.3f}km detected between "
                    f"{prev_str} and KP {kp_val:.3f} (row {row_num}). "
                    f"Expected maximum interval: {max_gap:.3f}km"
                ),
                expected=f"Gap <= {max_gap:.3f}km",
                actual=f"{gap_size:.3f}km gap",
                kp_value=kp_val,
            )
        )
    return issues
