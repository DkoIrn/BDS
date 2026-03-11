import numpy as np
import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.outliers import check_outliers_iqr, check_outliers_zscore


class TestZScoreOutliers:
    """Tests for z-score outlier detection (VALE-04)."""

    def test_extreme_value_flagged_as_warning(self):
        """Value beyond 3 sigma flagged as Warning with statistical context."""
        # Create data with one extreme outlier
        values = [1.0, 1.1, 1.0, 0.9, 1.0, 1.1, 0.9, 1.0, 1.0, 1.1, 50.0]
        df = pd.DataFrame({"dob": values, "kp": [i * 0.01 for i in range(len(values))]})
        issues = check_outliers_zscore(df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) >= 1
        assert issues[0].severity == Severity.WARNING
        assert issues[0].rule_type == "outlier_zscore"
        # Should include statistical context
        assert "z-score" in issues[0].message.lower() or "z_score" in issues[0].message.lower()

    def test_normal_values_no_issues(self, sample_df):
        """Value within 3 sigma produces no issues."""
        issues = check_outliers_zscore(sample_df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) == 0

    def test_zero_std_dev_skipped(self):
        """Column with zero std dev skipped (no crash, no issues)."""
        df = pd.DataFrame({"dob": [1.0, 1.0, 1.0, 1.0, 1.0], "kp": [0.0, 0.01, 0.02, 0.03, 0.04]})
        issues = check_outliers_zscore(df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) == 0

    def test_fewer_than_3_points_skipped(self):
        """Fewer than 3 data points skipped."""
        df = pd.DataFrame({"dob": [1.0, 50.0], "kp": [0.0, 0.01]})
        issues = check_outliers_zscore(df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) == 0

    def test_message_includes_stats(self):
        """Explanation includes mean, std, z-score values."""
        values = [1.0, 1.1, 1.0, 0.9, 1.0, 1.1, 0.9, 1.0, 1.0, 1.1, 50.0]
        df = pd.DataFrame({"dob": values, "kp": [i * 0.01 for i in range(len(values))]})
        issues = check_outliers_zscore(df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) >= 1
        msg = issues[0].message.lower()
        assert "mean" in msg
        assert "std" in msg


class TestIqrOutliers:
    """Tests for IQR outlier detection."""

    def test_value_beyond_iqr_fences_flagged(self):
        """Value beyond Q1-1.5*IQR or Q3+1.5*IQR flagged as Warning."""
        values = [1.0, 1.1, 1.0, 0.9, 1.0, 1.1, 0.9, 1.0, 1.0, 1.1, 50.0]
        df = pd.DataFrame({"dob": values, "kp": [i * 0.01 for i in range(len(values))]})
        issues = check_outliers_iqr(df, "dob", multiplier=1.5, kp_column="kp")
        assert len(issues) >= 1
        assert issues[0].severity == Severity.WARNING
        assert issues[0].rule_type == "outlier_iqr"
