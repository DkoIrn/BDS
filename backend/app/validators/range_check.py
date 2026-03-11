import pandas as pd

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location


def check_range(
    df: pd.DataFrame,
    column: str,
    min_val: float,
    max_val: float,
    tolerance: float = 0.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Check values in a column are within the specified range with tolerance."""
    issues: list[ValidationIssue] = []
    series = pd.to_numeric(df[column], errors="coerce")
    effective_min = min_val - tolerance
    effective_max = max_val + tolerance

    out_of_range = series[(series < effective_min) | (series > effective_max)].dropna()

    for idx in out_of_range.index:
        row_num = int(idx) + 1  # 1-based
        actual = float(series.iloc[series.index.get_loc(idx)])
        kp = (
            float(df[kp_column].iloc[df.index.get_loc(idx)])
            if kp_column and kp_column in df.columns
            else None
        )

        location = format_location(kp, row_num)
        tol_str = f" (tolerance: +/-{tolerance})" if tolerance > 0 else ""

        if actual > effective_max:
            direction = "maximum"
            limit = max_val
        else:
            direction = "minimum"
            limit = min_val

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=column,
                rule_type="range_check",
                severity=Severity.CRITICAL,
                message=(
                    f"{location}: {column.upper()} value {actual}m exceeds "
                    f"{direction} threshold of {limit}m{tol_str}"
                ),
                expected=f"{min_val} to {max_val}",
                actual=str(actual),
                kp_value=kp,
            )
        )
    return issues
