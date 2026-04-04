"""Tests for position consistency QC checks."""

import pandas as pd
import pytest

from app.validators.position import check_position_consistency


@pytest.fixture
def mappings_projected():
    return [
        {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        {"index": 1, "originalName": "easting", "mappedType": "easting", "ignored": False},
        {"index": 2, "originalName": "northing", "mappedType": "northing", "ignored": False},
    ]


@pytest.fixture
def mappings_geographic():
    return [
        {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        {"index": 1, "originalName": "latitude", "mappedType": "latitude", "ignored": False},
        {"index": 2, "originalName": "longitude", "mappedType": "longitude", "ignored": False},
    ]


class TestKpDistanceMismatch:
    def test_flags_kp_coord_disagreement(self, mappings_projected):
        """KP says 1km but coordinates only move 10m — should flag."""
        df = pd.DataFrame({
            "kp": [0.0, 1.0],  # 1 km apart
            "easting": [500000, 500010],  # only 10m apart
            "northing": [6000000, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        kp_dist = [i for i in issues if i.rule_type == "kp_distance_mismatch"]
        assert len(kp_dist) >= 1

    def test_no_flag_when_consistent(self, mappings_projected):
        """KP says 1km, coordinates say ~1km — should not flag."""
        df = pd.DataFrame({
            "kp": [0.0, 1.0],
            "easting": [500000, 501000],  # 1000m = 1km
            "northing": [6000000, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        kp_dist = [i for i in issues if i.rule_type == "kp_distance_mismatch"]
        assert len(kp_dist) == 0

    def test_works_with_geographic_coords(self, mappings_geographic):
        """KP says 1km but lat/lon barely moves — should flag."""
        df = pd.DataFrame({
            "kp": [0.0, 1.0],  # 1km
            "latitude": [51.0, 51.0],
            "longitude": [1.0, 1.00001],  # ~1m
        })
        issues = check_position_consistency(df, mappings_geographic, kp_column="kp")
        kp_dist = [i for i in issues if i.rule_type == "kp_distance_mismatch"]
        assert len(kp_dist) >= 1


class TestBearingContinuity:
    def test_flags_sharp_reversal(self, mappings_projected):
        """180-degree reversal should be flagged."""
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "easting": [500000, 500100, 500000],  # goes east then west
            "northing": [6000000, 6000000, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        bearing = [i for i in issues if i.rule_type == "bearing_discontinuity"]
        assert len(bearing) >= 1

    def test_no_flag_straight_line(self, mappings_projected):
        """Straight line should not flag."""
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2, 0.3],
            "easting": [500000, 500100, 500200, 500300],
            "northing": [6000000, 6000000, 6000000, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        bearing = [i for i in issues if i.rule_type == "bearing_discontinuity"]
        assert len(bearing) == 0

    def test_no_flag_gentle_curve(self, mappings_projected):
        """Gradual 45-degree curve should not flag."""
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2, 0.3],
            "easting": [500000, 500100, 500170, 500200],
            "northing": [6000000, 6000000, 6000070, 6000170],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        bearing = [i for i in issues if i.rule_type == "bearing_discontinuity"]
        assert len(bearing) == 0


class TestLateralDeviation:
    def test_flags_large_deviation(self, mappings_projected):
        """Middle point 500m off the line should flag."""
        df = pd.DataFrame({
            "kp": [0.0, 0.5, 1.0],
            "easting": [500000, 500500, 501000],  # straight east
            "northing": [6000000, 6000500, 6000000],  # middle point 500m north
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        lateral = [i for i in issues if i.rule_type == "lateral_deviation"]
        assert len(lateral) >= 1

    def test_no_flag_on_line(self, mappings_projected):
        """Points on a straight line should not flag."""
        df = pd.DataFrame({
            "kp": [0.0, 0.5, 1.0],
            "easting": [500000, 500500, 501000],
            "northing": [6000000, 6000000, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        lateral = [i for i in issues if i.rule_type == "lateral_deviation"]
        assert len(lateral) == 0


class TestEdgeCases:
    def test_empty_df_returns_no_issues(self, mappings_projected):
        df = pd.DataFrame({"kp": [], "easting": [], "northing": []})
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        assert len(issues) == 0

    def test_single_row_returns_no_issues(self, mappings_projected):
        df = pd.DataFrame({
            "kp": [0.0],
            "easting": [500000],
            "northing": [6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        assert len(issues) == 0

    def test_no_coord_columns_returns_empty(self):
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        ]
        df = pd.DataFrame({"kp": [0.0, 0.1]})
        issues = check_position_consistency(df, mappings, kp_column="kp")
        assert len(issues) == 0

    def test_handles_nan_coordinates(self, mappings_projected):
        import numpy as np
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "easting": [500000, np.nan, 500200],
            "northing": [6000000, np.nan, 6000000],
        })
        issues = check_position_consistency(df, mappings_projected, kp_column="kp")
        # Should not crash, may or may not produce issues
        assert isinstance(issues, list)
