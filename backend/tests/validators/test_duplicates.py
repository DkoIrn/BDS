import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.duplicates import check_duplicate_rows, check_near_duplicate_kp


class TestDuplicateRows:
    """Tests for duplicate row detection (VALE-03)."""

    def test_exact_duplicates_flagged_as_critical(self):
        """Exact duplicate rows flagged as Critical."""
        df = pd.DataFrame(
            {
                "kp": [0.0, 0.01, 0.01, 0.02],
                "dob": [1.0, 1.5, 1.5, 2.0],
                "doc": [0.8, 0.9, 0.9, 1.0],
            }
        )
        issues = check_duplicate_rows(df, kp_column="kp")
        assert len(issues) >= 2  # Both duplicate rows flagged
        assert all(i.severity == Severity.CRITICAL for i in issues)
        assert all(i.rule_type == "duplicate_row" for i in issues)

    def test_unique_rows_no_issues(self, sample_df):
        """Unique rows produce no issues."""
        issues = check_duplicate_rows(sample_df, kp_column="kp")
        assert len(issues) == 0


class TestNearDuplicateKp:
    """Tests for near-duplicate KP detection."""

    def test_near_duplicate_kp_flagged_as_critical(self):
        """Near-duplicate KP values (within tolerance) flagged as Critical."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.0105, 0.02]})
        issues = check_near_duplicate_kp(df, "kp", tolerance=0.001)
        assert len(issues) >= 1
        assert issues[0].severity == Severity.CRITICAL
        assert issues[0].rule_type == "near_duplicate_kp"

    def test_kp_beyond_tolerance_no_issues(self):
        """KP values spaced beyond tolerance produce no issues."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.02, 0.03]})
        issues = check_near_duplicate_kp(df, "kp", tolerance=0.001)
        assert len(issues) == 0
