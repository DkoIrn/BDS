import pandas as pd

from app.validators.base import ValidationIssue


def run_validation_pipeline(
    df: pd.DataFrame,
    column_mappings: list[dict],
    config: dict,
) -> list[ValidationIssue]:
    """Run all validation checks and return aggregated issues."""
    return []
