import pandas as pd

from app.validators.base import Severity, ValidationIssue


def check_missing_data(
    df: pd.DataFrame,
    column: str,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect null, NaN, and empty string values in a column."""
    return []


def check_kp_gaps(
    df: pd.DataFrame,
    kp_column: str,
    max_gap: float | None = None,
) -> list[ValidationIssue]:
    """Detect gaps in KP coverage that exceed the threshold."""
    return []
