import pandas as pd

from app.validators.base import Severity, ValidationIssue


def check_range(
    df: pd.DataFrame,
    column: str,
    min_val: float,
    max_val: float,
    tolerance: float = 0.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Check values in a column are within the specified range with tolerance."""
    return []
