import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.explanations import format_location
from app.validators.range_check import check_range
from app.validators.outliers import check_outliers_zscore


class TestFormatLocation:
    """Tests for explanation formatting (VALE-07)."""

    def test_format_with_kp_value(self):
        """Messages follow format: 'At KP {value} (row {n}): ...'"""
        result = format_location(kp_value=12.450, row_number=45)
        assert "At KP 12.450" in result
        assert "row 45" in result

    def test_format_without_kp(self):
        """When no KP column, format is 'Row {n}: ...'"""
        result = format_location(kp_value=None, row_number=45)
        assert result == "Row 45"
        assert "KP" not in result


class TestExplanationContent:
    """Tests that actual validator messages meet quality standards."""

    def test_every_issue_has_non_empty_message(self):
        """Every ValidationIssue has non-empty message field."""
        df = pd.DataFrame({"dob": [15.0], "kp": [12.450]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        assert len(issues) == 1
        assert issues[0].message
        assert len(issues[0].message) > 10

    def test_range_messages_include_expected_and_actual(self):
        """Range messages include expected range and actual value."""
        df = pd.DataFrame({"dob": [15.0], "kp": [12.450]})
        issues = check_range(df, "dob", min_val=0, max_val=10, kp_column="kp")
        assert len(issues) == 1
        msg = issues[0].message
        assert "15" in msg  # actual value
        assert "10" in msg  # max threshold

    def test_outlier_messages_include_stats(self):
        """Outlier messages include z-score, mean, std."""
        values = [1.0, 1.1, 1.0, 0.9, 1.0, 1.1, 0.9, 1.0, 1.0, 1.1, 50.0]
        df = pd.DataFrame({"dob": values, "kp": [i * 0.01 for i in range(len(values))]})
        issues = check_outliers_zscore(df, "dob", threshold=3.0, kp_column="kp")
        assert len(issues) >= 1
        msg = issues[0].message.lower()
        assert "z-score" in msg or "z_score" in msg
        assert "mean" in msg
        assert "std" in msg

    def test_messages_read_like_engineer_notes(self):
        """Messages read like a senior engineer's QC notes (have location + context)."""
        df = pd.DataFrame({"dob": [15.0], "kp": [12.450]})
        issues = check_range(df, "dob", min_val=0, max_val=10, tolerance=0.1, kp_column="kp")
        assert len(issues) == 1
        msg = issues[0].message
        # Should have location reference
        assert "KP" in msg
        # Should have technical detail
        assert "tolerance" in msg.lower() or "threshold" in msg.lower()
