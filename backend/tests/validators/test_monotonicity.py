import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.monotonicity import check_monotonicity


class TestMonotonicity:
    """Tests for KP monotonicity validation (VALE-05)."""

    def test_strictly_increasing_no_issues(self, sample_df):
        """Strictly increasing KP values produce no issues."""
        issues = check_monotonicity(sample_df, "kp")
        assert len(issues) == 0

    def test_decreasing_kp_flagged_as_critical(self):
        """Decreasing KP value flagged as Critical."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.005, 0.02]})
        issues = check_monotonicity(df, "kp")
        assert len(issues) >= 1
        assert any(i.severity == Severity.CRITICAL for i in issues)
        assert any(i.rule_type == "monotonicity" for i in issues)

    def test_equal_consecutive_kp_flagged_as_warning(self):
        """Equal consecutive KP values flagged as Warning."""
        df = pd.DataFrame({"kp": [0.0, 0.01, 0.01, 0.02]})
        issues = check_monotonicity(df, "kp")
        assert len(issues) >= 1
        assert any(i.severity == Severity.WARNING for i in issues)

    def test_single_row_no_issues(self):
        """Single row produces no issues."""
        df = pd.DataFrame({"kp": [0.0]})
        issues = check_monotonicity(df, "kp")
        assert len(issues) == 0

    def test_empty_data_no_issues(self):
        """Empty data produces no issues."""
        df = pd.DataFrame({"kp": pd.Series([], dtype=float)})
        issues = check_monotonicity(df, "kp")
        assert len(issues) == 0
