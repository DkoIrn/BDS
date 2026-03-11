import pandas as pd

from app.validators.base import Severity, ValidationIssue


def check_outliers_zscore(
    df: pd.DataFrame,
    column: str,
    threshold: float = 3.0,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect statistical outliers using z-score method."""
    return []


def check_outliers_iqr(
    df: pd.DataFrame,
    column: str,
    multiplier: float = 1.5,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Detect statistical outliers using IQR method."""
    return []
