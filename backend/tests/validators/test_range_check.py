import numpy as np
import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.range_check import check_range


class TestRangeCheck:
    """Tests for range/tolerance validation (VALE-01)."""

    def test_values_within_range_return_no_issues(self, sample_df):
        """Values within range produce no issues."""
        issues = check_range(sample_df, "dob", min_val=0, max_val=10)
        assert len(issues) == 0

    def test_value_above_max_returns_critical(self):
        """Value above max returns Critical issue with correct message."""
        df = pd.DataFrame({"dob": [1.0, 2.0, 15.0], "kp": [0.0, 0.01, 0.02]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        assert len(issues) == 1
        assert issues[0].severity == Severity.CRITICAL
        assert issues[0].column_name == "dob"
        assert "15" in issues[0].message
        assert "maximum" in issues[0].message.lower()

    def test_value_below_min_returns_critical(self):
        """Value below min returns Critical issue with correct message."""
        df = pd.DataFrame({"dob": [1.0, -5.0, 2.0], "kp": [0.0, 0.01, 0.02]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        assert len(issues) == 1
        assert issues[0].severity == Severity.CRITICAL
        assert "minimum" in issues[0].message.lower()

    def test_tolerance_applied_value_at_boundary_passes(self):
        """Value at max+tolerance passes, max+tolerance+0.01 fails."""
        df = pd.DataFrame({"dob": [10.1, 10.11], "kp": [0.0, 0.01]})
        # With tolerance of 0.1, max effective = 10.1
        issues = check_range(df, "dob", min_val=0, max_val=10, tolerance=0.1, kp_column="kp")
        # 10.1 is at boundary (passes), 10.11 exceeds (fails)
        assert len(issues) == 1
        assert "10.11" in issues[0].message

    def test_non_numeric_values_skipped(self):
        """Non-numeric values are skipped (no crash)."""
        df = pd.DataFrame({"dob": [1.0, "abc", 2.0, None], "kp": [0.0, 0.01, 0.02, 0.03]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        # Should not crash and should not flag non-numeric values
        assert all(isinstance(i, ValidationIssue) for i in issues)

    def test_kp_value_in_message_when_mapped(self):
        """KP value is included in message when KP column is mapped."""
        df = pd.DataFrame({"dob": [15.0], "kp": [12.450]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        assert len(issues) == 1
        assert "KP 12.450" in issues[0].message
        assert issues[0].kp_value == 12.450

    def test_falls_back_to_row_number_without_kp(self):
        """Falls back to row number when no KP column."""
        df = pd.DataFrame({"dob": [15.0]})
        issues = check_range(df, "dob", min_val=0, max_val=10)
        assert len(issues) == 1
        assert "Row" in issues[0].message
        assert issues[0].kp_value is None
