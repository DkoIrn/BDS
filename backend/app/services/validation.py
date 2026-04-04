import pandas as pd

from app.validators.base import ValidationIssue
from app.validators.range_check import check_range
from app.validators.missing_data import check_missing_data, check_kp_gaps
from app.validators.duplicates import check_duplicate_rows, check_near_duplicate_kp
from app.validators.outliers import check_outliers_zscore, check_outliers_iqr
from app.validators.monotonicity import check_monotonicity
from app.validators.consistency import check_cross_column_consistency
from app.validators.spikes import check_spikes
from app.validators.spatial import check_coordinate_sanity


# Column types that are numeric and should be validated
NUMERIC_COLUMN_TYPES = {
    "dob", "doc", "depth", "top", "elevation",
    "easting", "northing", "latitude", "longitude",
}

# Default range thresholds per column type (generous defaults)
DEFAULT_THRESHOLDS: dict[str, dict[str, float]] = {
    "dob": {"min": 0, "max": 10},
    "doc": {"min": 0, "max": 10},
    "depth": {"min": 0, "max": 500},
}


def _find_kp_column(column_mappings: list[dict]) -> str | None:
    """Find the KP column name from mappings."""
    for m in column_mappings:
        if m.get("mappedType") == "kp" and not m.get("ignored", False):
            return m.get("originalName", "kp")
    return None


def _get_mapped_columns(column_mappings: list[dict]) -> list[dict]:
    """Get non-ignored mapped columns."""
    return [
        m for m in column_mappings
        if m.get("mappedType") and not m.get("ignored", False)
    ]


def run_validation_pipeline(
    df: pd.DataFrame,
    column_mappings: list[dict],
    config: dict,
    enabled_checks: dict | None = None,
) -> list[ValidationIssue]:
    """Run all validation checks and return aggregated issues.

    Args:
        enabled_checks: Optional dict of check toggles. When None, all checks
            run (backward compatible). Keys: range_check, missing_data,
            duplicate_rows, near_duplicate_kp, outliers_zscore, outliers_iqr,
            kp_gaps, monotonicity.
    """
    all_issues: list[ValidationIssue] = []
    checks = enabled_checks or {}
    kp_column = _find_kp_column(column_mappings)

    # Per-column checks for numeric mapped columns
    for mapping in _get_mapped_columns(column_mappings):
        col_type = mapping.get("mappedType")
        col_name = mapping.get("originalName", col_type)

        if col_type not in NUMERIC_COLUMN_TYPES:
            continue

        if col_name not in df.columns:
            continue

        # Range check (if thresholds configured and check enabled)
        if checks.get("range_check", True):
            threshold_key_min = f"{col_type}_min"
            threshold_key_max = f"{col_type}_max"
            if threshold_key_min in config and threshold_key_max in config:
                all_issues.extend(
                    check_range(
                        df, col_name,
                        min_val=config[threshold_key_min],
                        max_val=config[threshold_key_max],
                        tolerance=config.get(f"{col_type}_tolerance", 0.0),
                        kp_column=kp_column,
                    )
                )
            elif col_type in DEFAULT_THRESHOLDS:
                defaults = DEFAULT_THRESHOLDS[col_type]
                all_issues.extend(
                    check_range(
                        df, col_name,
                        min_val=defaults["min"],
                        max_val=defaults["max"],
                        kp_column=kp_column,
                    )
                )

        # Missing data check
        if checks.get("missing_data", True):
            all_issues.extend(check_missing_data(df, col_name, kp_column=kp_column))

        # Outlier checks
        if checks.get("outliers_zscore", True):
            zscore_threshold = config.get("zscore_threshold", 3.0)
            all_issues.extend(
                check_outliers_zscore(df, col_name, threshold=zscore_threshold, kp_column=kp_column)
            )
        if checks.get("outliers_iqr", True):
            iqr_multiplier = config.get("iqr_multiplier", 1.5)
            all_issues.extend(
                check_outliers_iqr(df, col_name, multiplier=iqr_multiplier, kp_column=kp_column)
            )

    # KP-specific checks
    if kp_column and kp_column in df.columns:
        if checks.get("kp_gaps", True):
            kp_gap_max = config.get("kp_gap_max")
            all_issues.extend(check_kp_gaps(df, kp_column, max_gap=kp_gap_max))
        if checks.get("monotonicity", True):
            all_issues.extend(check_monotonicity(df, kp_column))
        if checks.get("near_duplicate_kp", True):
            duplicate_kp_tolerance = config.get("duplicate_kp_tolerance", 0.001)
            all_issues.extend(
                check_near_duplicate_kp(df, kp_column, tolerance=duplicate_kp_tolerance)
            )

    # Duplicate row check
    if checks.get("duplicate_rows", True):
        all_issues.extend(check_duplicate_rows(df, kp_column=kp_column))

    # --- Engineering-grade checks ---

    # Cross-column consistency (DOB vs depth, DOC vs DOB, etc.)
    if checks.get("cross_column", True):
        mapped = _get_mapped_columns(column_mappings)
        all_issues.extend(
            check_cross_column_consistency(df, mapped, kp_column=kp_column)
        )

    # Spike / gradient detection (per numeric column)
    if checks.get("spike_detection", True):
        for mapping in _get_mapped_columns(column_mappings):
            col_type = mapping.get("mappedType")
            col_name = mapping.get("originalName", col_type)
            if col_type not in NUMERIC_COLUMN_TYPES or col_name not in df.columns:
                continue
            all_issues.extend(
                check_spikes(df, col_name, kp_column=kp_column)
            )

    # Coordinate sanity (bounds + jumps)
    if checks.get("coordinate_sanity", True):
        mapped = _get_mapped_columns(column_mappings)
        all_issues.extend(
            check_coordinate_sanity(df, mapped, kp_column=kp_column)
        )

    return all_issues
