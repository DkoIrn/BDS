import pandas as pd

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location


def check_duplicate_rows(
    df: pd.DataFrame,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect exact duplicate rows."""
    issues: list[ValidationIssue] = []
    duplicated_mask = df.duplicated(keep=False)
    duplicate_rows = df[duplicated_mask]

    for idx in duplicate_rows.index:
        row_num = int(idx) + 1
        kp = None
        if kp_column and kp_column in df.columns and pd.notna(df[kp_column].iloc[df.index.get_loc(idx)]):
            kp = float(df[kp_column].iloc[df.index.get_loc(idx)])

        location = format_location(kp, row_num)

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name="all",
                rule_type="duplicate_row",
                severity=Severity.CRITICAL,
                message=f"{location}: Exact duplicate row detected",
                expected="Unique row",
                actual="Duplicate",
                kp_value=kp,
            )
        )
    return issues


def check_near_duplicate_kp(
    df: pd.DataFrame,
    kp_column: str,
    tolerance: float = 0.001,
) -> list[ValidationIssue]:
    """Detect near-duplicate KP values within the specified tolerance."""
    issues: list[ValidationIssue] = []
    kp = pd.to_numeric(df[kp_column], errors="coerce").dropna()
    if len(kp) < 2:
        return issues

    kp_sorted = kp.sort_values().reset_index(drop=True)
    diffs = kp_sorted.diff()
    near_dupes = diffs[(diffs >= 0) & (diffs < tolerance)].dropna()

    for pos in near_dupes.index:
        if pos == 0:
            continue
        row_num = int(pos) + 1
        kp_val = float(kp_sorted.iloc[pos])
        prev_kp = float(kp_sorted.iloc[pos - 1])

        issues.append(
            ValidationIssue(
                row_number=row_num,
                column_name=kp_column,
                rule_type="near_duplicate_kp",
                severity=Severity.CRITICAL,
                message=(
                    f"At KP {kp_val:.3f} (row {row_num}): Near-duplicate KP value. "
                    f"Distance from previous KP {prev_kp:.3f} is {float(diffs.iloc[pos]):.4f}km "
                    f"(tolerance: {tolerance}km)"
                ),
                expected=f"KP spacing >= {tolerance}km",
                actual=f"{float(diffs.iloc[pos]):.4f}km",
                kp_value=kp_val,
            )
        )
    return issues
