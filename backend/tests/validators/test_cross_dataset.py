"""Tests for cross-dataset validation: KP alignment, delta checks, relationship checks,
coverage gaps, preset selection, column auto-detection, and tolerance overrides."""

import os
from pathlib import Path

import pandas as pd
import pytest

from app.validators.base import Severity, ValidationIssue

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "cross_dataset"


@pytest.fixture
def dob_df():
    return pd.read_csv(FIXTURES_DIR / "dob_sample.csv")


@pytest.fixture
def doc_df():
    return pd.read_csv(FIXTURES_DIR / "doc_sample.csv")


# --- align_by_kp ---

class TestAlignByKP:
    def test_merge_by_nearest_kp(self, dob_df, doc_df):
        from app.validators.cross_dataset import align_by_kp

        merged = align_by_kp(dob_df, doc_df, "KP", "KP", tolerance=0.01)
        # Both datasets share KPs 0.000-0.850, so those should align
        assert len(merged) == len(dob_df)  # left join keeps all from dob
        # Columns from both datasets should be present
        assert "DOB" in merged.columns
        assert "DOC" in merged.columns

    def test_unmatched_rows_get_nan(self, dob_df, doc_df):
        from app.validators.cross_dataset import align_by_kp

        merged = align_by_kp(dob_df, doc_df, "KP", "KP", tolerance=0.01)
        # DOB has KP 0.900 and 0.950 which are NOT in DOC (DOC goes to 0.850)
        row_900 = merged[merged["KP"] == 0.900]
        assert len(row_900) == 1
        assert pd.isna(row_900["DOC"].iloc[0])

    def test_tight_tolerance_excludes_distant_kps(self):
        from app.validators.cross_dataset import align_by_kp

        df_a = pd.DataFrame({"KP": [0.0, 1.0], "val_a": [10, 20]})
        df_b = pd.DataFrame({"KP": [0.5, 1.5], "val_b": [30, 40]})
        merged = align_by_kp(df_a, df_b, "KP", "KP", tolerance=0.01)
        # With tolerance 0.01, no KPs should match (0.5 diff is too large)
        assert pd.isna(merged["val_b"].iloc[0])
        assert pd.isna(merged["val_b"].iloc[1])


# --- check_value_delta ---

class TestCheckValueDelta:
    def test_flags_delta_exceeding_tolerance(self):
        from app.validators.cross_dataset import align_by_kp, check_value_delta
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0, 0.1, 0.2], "Easting": [100.0, 200.0, 300.0]})
        df_b = pd.DataFrame({"KP": [0.0, 0.1, 0.2], "Easting": [100.5, 202.0, 300.2]})
        merged = align_by_kp(df_a, df_b, "KP", "KP", tolerance=0.01)

        preset = PRESETS["dob_vs_doc"]
        issues = check_value_delta(merged, "Easting_a", "Easting_b", tolerance=1.0, preset=preset)
        # Only KP=0.1 has delta=2.0 which exceeds 1.0
        assert len(issues) == 1
        assert issues[0].kp_value == pytest.approx(0.1)
        assert issues[0].rule_type == "cross_dataset"

    def test_no_issues_within_tolerance(self):
        from app.validators.cross_dataset import align_by_kp, check_value_delta
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0], "val": [10.0]})
        df_b = pd.DataFrame({"KP": [0.0], "val": [10.05]})
        merged = align_by_kp(df_a, df_b, "KP", "KP", tolerance=0.01)
        issues = check_value_delta(merged, "val_a", "val_b", tolerance=0.1, preset=PRESETS["dob_vs_doc"])
        assert len(issues) == 0


# --- check_relationship ---

class TestCheckRelationship:
    def test_flags_doc_exceeding_dob(self):
        """DOC > DOB should be flagged (burial must exceed cover)."""
        from app.validators.cross_dataset import align_by_kp, check_relationship
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0, 0.1, 0.2], "DOB": [1.2, 1.1, 1.5]})
        df_b = pd.DataFrame({"KP": [0.0, 0.1, 0.2], "DOC": [0.8, 1.5, 1.0]})
        merged = align_by_kp(df_a, df_b, "KP", "KP", tolerance=0.01)

        issues = check_relationship(merged, "DOB", "DOC", "a_gte_b", tolerance=0.0, preset=PRESETS["dob_vs_doc"])
        # KP=0.1: DOB=1.1, DOC=1.5 -> DOC > DOB -> flagged
        assert len(issues) == 1
        assert issues[0].kp_value == pytest.approx(0.1)
        assert issues[0].severity == Severity.CRITICAL

    def test_no_flag_when_dob_gte_doc(self):
        from app.validators.cross_dataset import align_by_kp, check_relationship
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0], "DOB": [2.0]})
        df_b = pd.DataFrame({"KP": [0.0], "DOC": [1.0]})
        merged = align_by_kp(df_a, df_b, "KP", "KP", tolerance=0.01)
        issues = check_relationship(merged, "DOB", "DOC", "a_gte_b", tolerance=0.0, preset=PRESETS["dob_vs_doc"])
        assert len(issues) == 0


# --- check_coverage_gaps ---

class TestCheckCoverageGaps:
    def test_flags_kp_range_in_one_but_not_other(self, dob_df, doc_df):
        from app.validators.cross_dataset import check_coverage_gaps
        from app.services.cross_validation_presets import PRESETS

        # DOB goes to 0.950, DOC goes to 0.850
        issues = check_coverage_gaps(dob_df, doc_df, "KP", PRESETS["dob_vs_doc"])
        assert len(issues) >= 1
        # Should flag that DOB has KP range beyond DOC
        gap_messages = [i.message for i in issues]
        assert any("coverage" in m.lower() or "gap" in m.lower() for m in gap_messages)
        assert all(i.rule_type == "cross_dataset" for i in issues)

    def test_no_gaps_when_ranges_identical(self):
        from app.validators.cross_dataset import check_coverage_gaps
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0, 0.5, 1.0]})
        df_b = pd.DataFrame({"KP": [0.0, 0.5, 1.0]})
        issues = check_coverage_gaps(df_a, df_b, "KP", PRESETS["dob_vs_doc"])
        assert len(issues) == 0


# --- run_cross_dataset_checks with presets ---

class TestRunCrossDatasetChecks:
    def test_dob_vs_doc_preset_returns_issues(self, dob_df, doc_df):
        from app.validators.cross_dataset import run_cross_dataset_checks
        from app.services.cross_validation_presets import PRESETS

        preset = PRESETS["dob_vs_doc"]
        issues = run_cross_dataset_checks(dob_df, doc_df, preset, column_mapping=[], config={})

        assert len(issues) > 0
        # Should detect: DOC > DOB at some KPs, coverage gap, easting delta at KP=0.750
        rule_types = set(i.rule_type for i in issues)
        assert "cross_dataset" in rule_types

    def test_position_vs_event_preset(self):
        from app.validators.cross_dataset import run_cross_dataset_checks
        from app.services.cross_validation_presets import PRESETS

        # Position data
        df_pos = pd.DataFrame({
            "KP": [0.0, 0.5, 1.0],
            "Easting": [500000.0, 500500.0, 501000.0],
            "Northing": [6000000.0, 6000000.0, 6000000.0],
        })
        # Event listing with position mismatch at KP=0.5
        df_event = pd.DataFrame({
            "KP": [0.0, 0.5, 1.0],
            "Easting": [500000.0, 500510.0, 501000.0],  # 10m off at KP=0.5
            "Northing": [6000000.0, 6000000.0, 6000000.0],
        })

        preset = PRESETS["position_vs_event"]
        issues = run_cross_dataset_checks(df_pos, df_event, preset, column_mapping=[], config={})

        assert len(issues) > 0
        # Easting delta of 10m exceeds 5.0m tolerance at KP=0.5
        easting_issues = [i for i in issues if "easting" in i.column_name.lower() or "Easting" in i.column_name]
        assert len(easting_issues) >= 1


# --- auto_match_columns ---

class TestAutoMatchColumns:
    def test_matches_synonyms(self):
        from app.services.cross_validation_presets import auto_match_columns

        headers_a = ["KP", "Burial Depth", "Easting", "Northing"]
        headers_b = ["Chainage", "DOC", "East", "North"]

        matches = auto_match_columns(headers_a, headers_b)
        match_types = {m["type"] for m in matches}
        assert "kp" in match_types  # KP matched to Chainage
        assert "easting" in match_types  # Easting matched to East
        assert "northing" in match_types  # Northing matched to North

    def test_no_match_for_unknown_columns(self):
        from app.services.cross_validation_presets import auto_match_columns

        headers_a = ["CustomField1"]
        headers_b = ["CustomField2"]
        matches = auto_match_columns(headers_a, headers_b)
        assert len(matches) == 0


# --- Issue format validation ---

class TestIssueFormat:
    def test_all_issues_have_correct_rule_type_and_row_zero(self, dob_df, doc_df):
        from app.validators.cross_dataset import run_cross_dataset_checks
        from app.services.cross_validation_presets import PRESETS

        issues = run_cross_dataset_checks(dob_df, doc_df, PRESETS["dob_vs_doc"], [], {})

        for issue in issues:
            assert issue.rule_type == "cross_dataset"
            assert issue.row_number == 0
            assert issue.kp_value is not None

    def test_issues_have_populated_kp_value(self, dob_df, doc_df):
        from app.validators.cross_dataset import run_cross_dataset_checks
        from app.services.cross_validation_presets import PRESETS

        issues = run_cross_dataset_checks(dob_df, doc_df, PRESETS["dob_vs_doc"], [], {})
        for issue in issues:
            assert isinstance(issue.kp_value, float)


# --- Tolerance overrides ---

class TestToleranceOverrides:
    def test_config_tolerance_overrides_preset(self):
        from app.validators.cross_dataset import run_cross_dataset_checks
        from app.services.cross_validation_presets import PRESETS

        df_a = pd.DataFrame({"KP": [0.0], "DOB": [1.2], "Easting": [100.0], "Northing": [200.0]})
        df_b = pd.DataFrame({"KP": [0.0], "DOC": [0.8], "Easting": [100.5], "Northing": [200.0]})

        preset = PRESETS["dob_vs_doc"]

        # Default easting tolerance is 1.0, delta is 0.5 -> no easting issue
        issues_default = run_cross_dataset_checks(df_a, df_b, preset, [], {})
        easting_default = [i for i in issues_default if "easting" in i.column_name.lower()]
        assert len(easting_default) == 0

        # Override easting tolerance to 0.1 -> should now flag
        issues_override = run_cross_dataset_checks(
            df_a, df_b, preset, [],
            {"easting_easting_tolerance": 0.1},
        )
        easting_override = [i for i in issues_override if "easting" in i.column_name.lower()]
        assert len(easting_override) == 1
