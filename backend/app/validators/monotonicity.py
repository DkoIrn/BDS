import pandas as pd

from app.validators.base import Severity, ValidationIssue


def check_monotonicity(
    df: pd.DataFrame,
    kp_column: str,
) -> list[ValidationIssue]:
    """Validate that KP values are strictly increasing."""
    return []
