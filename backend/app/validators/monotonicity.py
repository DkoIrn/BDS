import pandas as pd

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location


def check_monotonicity(
    df: pd.DataFrame,
    kp_column: str,
) -> list[ValidationIssue]:
    """Validate that KP values are strictly increasing."""
    issues: list[ValidationIssue] = []
    kp = pd.to_numeric(df[kp_column], errors="coerce").dropna()

    if len(kp) < 2:
        return issues

    diffs = kp.diff()

    for idx in diffs.index:
        if pd.isna(diffs[idx]):
            continue

        diff_val = float(diffs[idx])

        if diff_val < 0:
            row_num = int(idx) + 1
            current_kp = float(kp[idx])
            prev_idx = kp.index[kp.index.get_loc(idx) - 1]
            prev_kp = float(kp[prev_idx])

            issues.append(
                ValidationIssue(
                    row_number=row_num,
                    column_name=kp_column,
                    rule_type="monotonicity",
                    severity=Severity.CRITICAL,
                    message=(
                        f"At KP {current_kp:.3f} (row {row_num}): KP value decreased "
                        f"from {prev_kp:.3f} to {current_kp:.3f}. "
                        f"KP values must be strictly increasing."
                    ),
                    expected=f"> {prev_kp:.3f}",
                    actual=str(current_kp),
                    kp_value=current_kp,
                )
            )
        elif diff_val == 0:
            row_num = int(idx) + 1
            current_kp = float(kp[idx])
            prev_idx = kp.index[kp.index.get_loc(idx) - 1]
            prev_kp = float(kp[prev_idx])

            issues.append(
                ValidationIssue(
                    row_number=row_num,
                    column_name=kp_column,
                    rule_type="monotonicity",
                    severity=Severity.WARNING,
                    message=(
                        f"At KP {current_kp:.3f} (row {row_num}): KP value unchanged "
                        f"from previous row ({prev_kp:.3f}). "
                        f"KP values should be strictly increasing."
                    ),
                    expected=f"> {prev_kp:.3f}",
                    actual=str(current_kp),
                    kp_value=current_kp,
                )
            )

    return issues
