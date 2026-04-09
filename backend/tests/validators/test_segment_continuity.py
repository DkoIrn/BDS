"""Tests for segment continuity validator."""

import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue
from app.validators.segment_continuity import check_segment_continuity


class TestSegmentContinuity:
    """Tests for segment continuity detection."""

    def test_large_jump_flagged_as_critical(self):
        """500m jump between consecutive rows (max=100m) -> flags as critical."""
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "easting": [500000.0, 500050.0, 500550.0],  # 500m jump at row 2->3
            "northing": [6000000.0, 6000000.0, 6000000.0],
        })
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
            {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
        ]
        issues = check_segment_continuity(
            df, mappings, kp_column="kp", max_segment_distance=100.0,
            severity_override="critical",
        )
        assert len(issues) >= 1
        flagged = [i for i in issues if i.rule_type == "segment_continuity"]
        assert len(flagged) >= 1
        assert flagged[0].severity == Severity.CRITICAL
        assert "500" in flagged[0].message or "Segment distance" in flagged[0].message

    def test_normal_progression_no_issues(self):
        """Normal progression (all segments < 50m) -> returns 0 issues."""
        df = pd.DataFrame({
            "kp": [0.0, 0.05, 0.1, 0.15],
            "easting": [500000.0, 500040.0, 500080.0, 500120.0],
            "northing": [6000000.0, 6000000.0, 6000000.0, 6000000.0],
        })
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
            {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
        ]
        issues = check_segment_continuity(
            df, mappings, kp_column="kp", max_segment_distance=100.0,
        )
        assert len(issues) == 0

    def test_missing_columns_returns_empty(self):
        """Missing coordinate columns -> returns empty list."""
        df = pd.DataFrame({"kp": [0.0, 0.1], "dob": [1.0, 2.0]})
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "dob", "mappedType": "dob", "ignored": False},
        ]
        issues = check_segment_continuity(df, mappings, kp_column="kp")
        assert issues == []
