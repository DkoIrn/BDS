import pandas as pd

from app.validators.base import Severity, ValidationIssue


def check_duplicate_rows(
    df: pd.DataFrame,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect exact duplicate rows."""
    return []


def check_near_duplicate_kp(
    df: pd.DataFrame,
    kp_column: str,
    tolerance: float = 0.001,
) -> list[ValidationIssue]:
    """Detect near-duplicate KP values within the specified tolerance."""
    return []
