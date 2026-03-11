import numpy as np
import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.missing_data import check_kp_gaps, check_missing_data


class TestMissingData:
    """Tests for missing data detection (VALE-02)."""

    def test_null_cells_flagged_as_info(self):
        """Null/NaN cells flagged as Info severity."""
        df = pd.DataFrame({"dob": [1.0, None, 2.0], "kp": [0.0, 0.01, 0.02]})
        issues = check_missing_data(df, "dob", kp_column="kp")
        assert len(issues) == 1
        assert issues[0].severity == Severity.INFO
        assert issues[0].rule_type == "missing_data"

    def test_empty_string_cells_flagged_as_info(self):
        """Empty string cells flagged as Info severity."""
        df = pd.DataFrame({"dob": ["1.0", "", "2.0"], "kp": [0.0, 0.01, 0.02]})
        issues = check_missing_data(df, "dob", kp_column="kp")
        assert len(issues) == 1
        assert issues[0].severity == Severity.INFO

    def test_non_null_cells_no_issues(self, sample_df):
        """Non-null cells produce no issues."""
        issues = check_missing_data(sample_df, "dob", kp_column="kp")
        assert len(issues) == 0


class TestKpGaps:
    """Tests for KP coverage gap detection."""

    def test_large_gap_flagged_as_warning(self):
        """Gap larger than threshold flagged as Warning."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.02, 0.50, 0.51]})
        issues = check_kp_gaps(df, "kp", max_gap=0.1)
        assert len(issues) >= 1
        assert issues[0].severity == Severity.WARNING
        assert issues[0].rule_type == "kp_gap"

    def test_normal_spacing_no_issues(self):
        """Normal spacing produces no issues."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.02, 0.03, 0.04]})
        issues = check_kp_gaps(df, "kp", max_gap=0.1)
        assert len(issues) == 0

    def test_dynamic_threshold_uses_median(self):
        """Uses median*3 as dynamic threshold when no explicit threshold."""
        # Normal spacing is 0.01, so median*3 = 0.03
        # A gap of 0.05 should be flagged
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.02, 0.03, 0.08, 0.09]})
        issues = check_kp_gaps(df, "kp")  # No max_gap provided
        assert len(issues) >= 1
        assert issues[0].severity == Severity.WARNING
