"""Tests for KP drift validator."""

import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.kp_drift import check_kp_drift


class TestKpDrift:
    """Tests for cumulative KP drift detection."""

    def test_drift_above_tolerance_flags_rows(self):
        """DataFrame with coords that drift 5% from expected KP -> flags rows above 1% tolerance."""
        # KP increments of 0.1km each, but coords drift: actual distance ~0.105km per step (5% drift)
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2, 0.3],
            "easting": [500000.0, 500105.0, 500210.0, 500315.0],
            "northing": [6000000.0, 6000000.0, 6000000.0, 6000000.0],
        })
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
            {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
        ]
        issues = check_kp_drift(
            df, mappings, kp_column="kp", kp_drift_tolerance=0.01,
        )
        # Each step has ~5% drift (105m vs 100m expected), should flag
        assert len(issues) > 0
        assert all(i.rule_type == "kp_drift" for i in issues)
        assert all(i.severity == Severity.WARNING for i in issues)

    def test_consistent_kp_coords_no_issues(self):
        """DataFrame with consistent KP-coordinate agreement -> returns 0 issues."""
        # KP increments of 0.1km, coords exactly 100m apart (projected)
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2, 0.3],
            "easting": [500000.0, 500100.0, 500200.0, 500300.0],
            "northing": [6000000.0, 6000000.0, 6000000.0, 6000000.0],
        })
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
            {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
        ]
        issues = check_kp_drift(
            df, mappings, kp_column="kp", kp_drift_tolerance=0.01,
        )
        assert len(issues) == 0

    def test_missing_columns_returns_empty(self):
        """Missing KP or coordinate columns -> returns empty list (no crash)."""
        df = pd.DataFrame({"kp": [0.0, 0.1], "some_col": [1.0, 2.0]})
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "some_col", "mappedType": "dob", "ignored": False},
        ]
        issues = check_kp_drift(df, mappings, kp_column="kp")
        assert issues == []

    def test_identical_consecutive_coords_no_division_by_zero(self):
        """Identical consecutive coordinates -> skipped (no division by zero)."""
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "easting": [500000.0, 500000.0, 500100.0],
            "northing": [6000000.0, 6000000.0, 6000000.0],
        })
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
            {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
        ]
        # Should not raise, should skip the zero-distance pair
        issues = check_kp_drift(df, mappings, kp_column="kp")
        assert isinstance(issues, list)
