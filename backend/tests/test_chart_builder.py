"""Tests for chart builder service -- severity pie and KP density charts."""

import pytest

from app.services.chart_builder import generate_kp_density_chart, generate_severity_pie


class TestSeverityPie:
    """Tests for generate_severity_pie function."""

    def test_returns_image_with_counts(self):
        img = generate_severity_pie(critical=3, warning=5, info=2)
        assert img is not None
        assert img.mode == "RGB"
        assert img.size[0] > 100
        assert img.size[1] > 100

    def test_all_zero_returns_none(self):
        result = generate_severity_pie(critical=0, warning=0, info=0)
        assert result is None

    def test_single_wedge(self):
        img = generate_severity_pie(critical=5, warning=0, info=0)
        assert img is not None
        assert img.mode == "RGB"
        assert img.size[0] > 100
        assert img.size[1] > 100

    def test_two_categories(self):
        img = generate_severity_pie(critical=0, warning=3, info=7)
        assert img is not None
        assert img.mode == "RGB"


class TestKPDensityChart:
    """Tests for generate_kp_density_chart function."""

    def test_returns_image_with_kp_issues(self):
        issues = [
            {"kp_value": 0.5, "severity": "critical"},
            {"kp_value": 1.2, "severity": "warning"},
            {"kp_value": 2.0, "severity": "info"},
        ]
        img = generate_kp_density_chart(issues)
        assert img is not None
        assert img.mode == "RGB"
        assert img.size[0] > 100
        assert img.size[1] > 100

    def test_empty_list_returns_none(self):
        result = generate_kp_density_chart([])
        assert result is None

    def test_no_kp_values_returns_none(self):
        issues = [
            {"severity": "critical"},
            {"severity": "warning", "kp_value": None},
        ]
        result = generate_kp_density_chart(issues)
        assert result is None

    def test_mixed_kp_and_no_kp(self):
        issues = [
            {"kp_value": 1.0, "severity": "critical"},
            {"severity": "warning"},  # no kp_value
            {"kp_value": 3.0, "severity": "info"},
        ]
        img = generate_kp_density_chart(issues)
        assert img is not None
        assert img.mode == "RGB"
