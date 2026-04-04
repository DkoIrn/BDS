"""Tests for event listing QC checks."""

import numpy as np
import pandas as pd
import pytest

from app.validators.event_listing import check_event_listing


@pytest.fixture
def mappings_event():
    return [
        {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        {"index": 1, "originalName": "event", "mappedType": "event", "ignored": False},
        {"index": 2, "originalName": "description", "mappedType": "description", "ignored": False},
    ]


class TestMissingEventCode:
    def test_flags_empty_event_codes(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "event": ["ANCHOR", "", "CROSSING"],
            "description": ["Anchor point", "No event", "Road crossing"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        missing = [i for i in issues if i.rule_type == "missing_event_code"]
        assert len(missing) == 1
        assert missing[0].row_number == 3  # row index 1 + 2

    def test_flags_nan_event_codes(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1],
            "event": ["ANCHOR", np.nan],
            "description": ["Anchor point", "Missing"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        missing = [i for i in issues if i.rule_type == "missing_event_code"]
        assert len(missing) == 1

    def test_no_flags_when_all_events_present(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "event": ["ANCHOR", "CROSSING", "JOINT"],
            "description": ["A", "B", "C"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        missing = [i for i in issues if i.rule_type == "missing_event_code"]
        assert len(missing) == 0


class TestMissingEventDescription:
    def test_flags_missing_description(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1],
            "event": ["ANCHOR", "CROSSING"],
            "description": ["Anchor point", ""],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        desc_issues = [i for i in issues if i.rule_type == "missing_event_description"]
        assert len(desc_issues) == 1
        assert desc_issues[0].row_number == 3

    def test_no_flag_when_event_also_missing(self, mappings_event):
        """Empty event + empty description should NOT flag missing_event_description."""
        df = pd.DataFrame({
            "kp": [0.0],
            "event": [""],
            "description": [""],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        desc_issues = [i for i in issues if i.rule_type == "missing_event_description"]
        assert len(desc_issues) == 0

    def test_skipped_when_no_description_column(self):
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
            {"index": 1, "originalName": "event", "mappedType": "event", "ignored": False},
        ]
        df = pd.DataFrame({
            "kp": [0.0],
            "event": ["ANCHOR"],
        })
        issues = check_event_listing(df, mappings, kp_column="kp")
        desc_issues = [i for i in issues if i.rule_type == "missing_event_description"]
        assert len(desc_issues) == 0


class TestDuplicateEvents:
    def test_flags_duplicate_event_at_same_kp(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.1],
            "event": ["ANCHOR", "CROSSING", "CROSSING"],
            "description": ["A", "B", "B again"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        dup_issues = [i for i in issues if i.rule_type == "duplicate_event"]
        assert len(dup_issues) == 1
        assert dup_issues[0].row_number == 4  # index 2 + 2

    def test_no_flag_different_events_same_kp(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.1, 0.1],
            "event": ["ANCHOR", "CROSSING"],
            "description": ["A", "B"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        dup_issues = [i for i in issues if i.rule_type == "duplicate_event"]
        assert len(dup_issues) == 0

    def test_case_insensitive_duplicate(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.1, 0.1],
            "event": ["Anchor", "ANCHOR"],
            "description": ["A", "B"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        dup_issues = [i for i in issues if i.rule_type == "duplicate_event"]
        assert len(dup_issues) == 1


class TestEventKpOrder:
    def test_flags_out_of_order_events(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.2, 0.1],
            "event": ["A", "B", "C"],
            "description": ["X", "Y", "Z"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        order_issues = [i for i in issues if i.rule_type == "event_kp_order"]
        assert len(order_issues) == 1
        assert order_issues[0].row_number == 4

    def test_no_flag_when_in_order(self, mappings_event):
        df = pd.DataFrame({
            "kp": [0.0, 0.1, 0.2],
            "event": ["A", "B", "C"],
            "description": ["X", "Y", "Z"],
        })
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        order_issues = [i for i in issues if i.rule_type == "event_kp_order"]
        assert len(order_issues) == 0


class TestEmptyDataFrame:
    def test_empty_df_returns_no_issues(self, mappings_event):
        df = pd.DataFrame({"kp": [], "event": [], "description": []})
        issues = check_event_listing(df, mappings_event, kp_column="kp")
        assert len(issues) == 0

    def test_no_event_column_returns_no_issues(self):
        mappings = [
            {"index": 0, "originalName": "kp", "mappedType": "kp", "ignored": False},
        ]
        df = pd.DataFrame({"kp": [0.0, 0.1]})
        issues = check_event_listing(df, mappings, kp_column="kp")
        assert len(issues) == 0
