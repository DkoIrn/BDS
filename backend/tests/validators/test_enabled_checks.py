"""Tests for enabled_checks filtering in run_validation_pipeline."""

import numpy as np
import pandas as pd
import pytest

from app.services.validation import run_validation_pipeline


@pytest.fixture
def df_with_issues() -> pd.DataFrame:
    """DataFrame with known issues across multiple check types.

    Contains: out-of-range DOB, duplicate rows, KP gap, outlier, missing data.
    """
    return pd.DataFrame(
        {
            "kp": [
                0.000, 0.010, 0.020, 0.030, 0.040,
                0.050, 0.060, 0.070, 0.080, 0.090,
                # KP gap: jump from 0.090 to 0.500
                0.500, 0.510, 0.520, 0.530, 0.540,
                # Duplicate rows at end
                0.540, 0.550, 0.560, 0.570, 0.580,
            ],
            "dob": [
                1.2, 1.3, 1.1, 1.4, 1.2,
                1.5, 1.3, 1.2, 1.4, 1.1,
                # Out-of-range value (>5)
                99.0, 1.2, 1.5, 1.4, 1.3,
                # Duplicate of row 14
                1.3, 1.2, 1.1, 1.4, 1.3,
            ],
            "doc": [
                0.8, 0.9, 0.7, 0.8, 0.9,
                1.0, 0.8, 0.7, 0.9, 0.8,
                1.0, 0.9, 0.8, 0.7, 0.9,
                0.9, 0.8, np.nan, 0.9, 0.8,
            ],
        }
    )


@pytest.fixture
def mappings_with_issues() -> list[dict]:
    return [
        {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        {"index": 1, "originalName": "dob", "mappedType": "dob", "ignored": False},
        {"index": 2, "originalName": "doc", "mappedType": "doc", "ignored": False},
    ]


@pytest.fixture
def config_with_ranges() -> dict:
    return {
        "dob_min": 0, "dob_max": 5,
        "doc_min": 0, "doc_max": 3,
        "kp_gap_max": 0.1,
        "duplicate_kp_tolerance": 0.001,
        "zscore_threshold": 3.0,
        "iqr_multiplier": 1.5,
    }


class TestEnabledChecksFiltering:
    def test_disable_range_check_removes_range_issues(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        """Disabling range_check produces zero range_check issues."""
        enabled = {
            "range_check": False,
            "missing_data": True,
            "duplicate_rows": True,
            "near_duplicate_kp": True,
            "outliers_zscore": True,
            "outliers_iqr": True,
            "kp_gaps": True,
            "monotonicity": True,
        }
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=enabled,
        )
        range_issues = [i for i in issues if i.rule_type == "range_check"]
        assert len(range_issues) == 0

    def test_disable_outliers_zscore_skips_zscore(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        enabled = {
            "range_check": True,
            "missing_data": True,
            "duplicate_rows": True,
            "near_duplicate_kp": True,
            "outliers_zscore": False,
            "outliers_iqr": True,
            "kp_gaps": True,
            "monotonicity": True,
        }
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=enabled,
        )
        zscore_issues = [i for i in issues if i.rule_type == "outlier_zscore"]
        assert len(zscore_issues) == 0

    def test_disable_kp_gaps_skips_gap_detection(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        enabled = {
            "range_check": True,
            "missing_data": True,
            "duplicate_rows": True,
            "near_duplicate_kp": True,
            "outliers_zscore": True,
            "outliers_iqr": True,
            "kp_gaps": False,
            "monotonicity": True,
        }
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=enabled,
        )
        kp_gap_issues = [i for i in issues if i.rule_type == "kp_gap"]
        assert len(kp_gap_issues) == 0

    def test_disable_monotonicity_skips_monotonicity_check(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        enabled = {
            "range_check": True,
            "missing_data": True,
            "duplicate_rows": True,
            "near_duplicate_kp": True,
            "outliers_zscore": True,
            "outliers_iqr": True,
            "kp_gaps": True,
            "monotonicity": False,
        }
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=enabled,
        )
        mono_issues = [i for i in issues if i.rule_type == "monotonicity"]
        assert len(mono_issues) == 0

    def test_none_enabled_checks_runs_all(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        """None enabled_checks = backward compatible, runs everything."""
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=None,
        )
        # Should have at least some issues (range, outlier, kp gap, etc.)
        assert len(issues) > 0

    def test_all_checks_disabled_returns_empty(
        self, df_with_issues, mappings_with_issues, config_with_ranges,
    ):
        enabled = {
            "range_check": False,
            "missing_data": False,
            "duplicate_rows": False,
            "near_duplicate_kp": False,
            "outliers_zscore": False,
            "outliers_iqr": False,
            "kp_gaps": False,
            "monotonicity": False,
            "cross_column": False,
            "spike_detection": False,
            "coordinate_sanity": False,
        }
        issues = run_validation_pipeline(
            df_with_issues, mappings_with_issues, config_with_ranges,
            enabled_checks=enabled,
        )
        assert len(issues) == 0
