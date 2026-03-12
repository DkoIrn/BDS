"""Tests for ProfileConfig, EnabledChecks, and RangeThreshold Pydantic models."""

import pytest
from pydantic import ValidationError

from app.models.schemas import EnabledChecks, ProfileConfig, RangeThreshold


class TestRangeThreshold:
    def test_valid_range(self):
        r = RangeThreshold(min=0, max=10)
        assert r.min == 0
        assert r.max == 10

    def test_rejects_min_greater_than_max(self):
        with pytest.raises(ValidationError):
            RangeThreshold(min=10, max=5)

    def test_equal_min_max_allowed(self):
        r = RangeThreshold(min=5, max=5)
        assert r.min == r.max


class TestEnabledChecks:
    def test_defaults_all_true(self):
        checks = EnabledChecks()
        assert checks.range_check is True
        assert checks.missing_data is True
        assert checks.duplicate_rows is True
        assert checks.near_duplicate_kp is True
        assert checks.outliers_zscore is True
        assert checks.outliers_iqr is True
        assert checks.kp_gaps is True
        assert checks.monotonicity is True

    def test_can_disable_individual(self):
        checks = EnabledChecks(range_check=False)
        assert checks.range_check is False
        assert checks.missing_data is True


class TestProfileConfig:
    def test_defaults_produce_valid_config(self):
        """ProfileConfig with no arguments produces valid General Survey defaults."""
        config = ProfileConfig()
        assert config.zscore_threshold == 3.0
        assert config.iqr_multiplier == 1.5
        assert config.duplicate_kp_tolerance == 0.001
        assert isinstance(config.enabled_checks, EnabledChecks)
        assert config.ranges == {}

    def test_rejects_negative_zscore_threshold(self):
        with pytest.raises(ValidationError):
            ProfileConfig(zscore_threshold=-1.0)

    def test_rejects_negative_iqr_multiplier(self):
        with pytest.raises(ValidationError):
            ProfileConfig(iqr_multiplier=-0.5)

    def test_valid_config_with_ranges(self):
        config = ProfileConfig(
            ranges={"dob": RangeThreshold(min=0, max=5)},
            zscore_threshold=2.5,
        )
        assert config.ranges["dob"].min == 0
        assert config.ranges["dob"].max == 5
        assert config.zscore_threshold == 2.5

    def test_zero_zscore_allowed(self):
        config = ProfileConfig(zscore_threshold=0.0)
        assert config.zscore_threshold == 0.0
