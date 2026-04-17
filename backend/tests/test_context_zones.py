"""Tests for context-aware QC zones: models, service, and presets."""

from __future__ import annotations

import pandas as pd
import pytest
from unittest.mock import patch, MagicMock

from pydantic import ValidationError

from app.models.schemas import ContextZoneDefinition
from app.services.context_zones import (
    ContextZone,
    apply_context_zones,
    _modify_config,
    _get_zone_mask,
)
from app.services.context_zone_presets import PRESET_ZONES, get_preset_zones, create_zone_from_preset


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_df():
    """DataFrame with kp, depth, dob, and event_listing columns."""
    return pd.DataFrame({
        "kp": [0.5, 1.0, 1.5, 5.0, 10.0, 15.0, 20.0],
        "depth": [10.0, 12.0, 11.0, 50.0, 80.0, 90.0, 100.0],
        "dob": [0.5, 0.8, 0.6, 1.2, 2.0, 3.0, 2.5],
        "event_listing": ["", "", "trench crossing", "", "", "span", ""],
    })


@pytest.fixture
def column_mappings():
    return [
        {"originalName": "kp", "mappedType": "kp", "ignored": False},
        {"originalName": "depth", "mappedType": "depth", "ignored": False},
        {"originalName": "dob", "mappedType": "dob", "ignored": False},
        {"originalName": "event_listing", "mappedType": "event_listing", "ignored": False},
    ]


@pytest.fixture
def base_config():
    return {"dob_max": 3.0, "depth_max": 100.0, "zscore_threshold": 3.0}


@pytest.fixture
def enabled_checks():
    return {"range_check": True, "outliers_zscore": True}


# ---------------------------------------------------------------------------
# ContextZoneDefinition model validation
# ---------------------------------------------------------------------------

class TestContextZoneDefinition:
    def test_kp_range_requires_kp_start_le_kp_end(self):
        """kp_range zone must have kp_start <= kp_end."""
        with pytest.raises(ValidationError):
            ContextZoneDefinition(
                name="Bad range",
                zone_type="kp_range",
                kp_start=10.0,
                kp_end=5.0,
            )

    def test_kp_range_valid(self):
        zone = ContextZoneDefinition(
            name="Shore",
            zone_type="kp_range",
            kp_start=0.0,
            kp_end=2.0,
            threshold_modifiers={"dob_max": 1.5},
        )
        assert zone.kp_start == 0.0
        assert zone.kp_end == 2.0

    def test_event_match_requires_non_empty_event_value(self):
        """event_match zone requires a non-empty event_value."""
        with pytest.raises(ValidationError):
            ContextZoneDefinition(
                name="Bad event",
                zone_type="event_match",
                event_value="",
            )

    def test_event_match_valid(self):
        zone = ContextZoneDefinition(
            name="Trench",
            zone_type="event_match",
            event_value="trench crossing",
            threshold_modifiers={"dob_max": 2.0},
        )
        assert zone.event_value == "trench crossing"

    def test_kp_range_missing_start_end(self):
        with pytest.raises(ValidationError):
            ContextZoneDefinition(
                name="Missing KP",
                zone_type="kp_range",
            )


# ---------------------------------------------------------------------------
# _modify_config
# ---------------------------------------------------------------------------

class TestModifyConfig:
    def test_multiplier_applied_correctly(self):
        """1.5 multiplier on 3.0 should produce 4.5."""
        base = {"dob_max": 3.0, "depth_max": 100.0}
        result = _modify_config(base, {"dob_max": 1.5})
        assert result["dob_max"] == pytest.approx(4.5)
        assert result["depth_max"] == 100.0  # unchanged

    def test_multiple_modifiers(self):
        base = {"dob_max": 3.0, "depth_max": 100.0}
        result = _modify_config(base, {"dob_max": 2.0, "depth_max": 0.5})
        assert result["dob_max"] == pytest.approx(6.0)
        assert result["depth_max"] == pytest.approx(50.0)

    def test_missing_key_ignored(self):
        base = {"dob_max": 3.0}
        result = _modify_config(base, {"nonexistent_key": 1.5})
        assert result["dob_max"] == 3.0

    def test_does_not_mutate_original(self):
        base = {"dob_max": 3.0}
        _modify_config(base, {"dob_max": 2.0})
        assert base["dob_max"] == 3.0


# ---------------------------------------------------------------------------
# _get_zone_mask
# ---------------------------------------------------------------------------

class TestGetZoneMask:
    def test_kp_range_mask(self, sample_df):
        zone = ContextZone(
            id="z1", name="Shore", zone_type="kp_range",
            kp_start=0.0, kp_end=2.0, threshold_modifiers={},
        )
        mask = _get_zone_mask(sample_df, zone, "kp")
        # kp values 0.5, 1.0, 1.5 are in [0, 2]
        assert mask.sum() == 3

    def test_event_match_mask(self, sample_df, column_mappings):
        zone = ContextZone(
            id="z2", name="Trench", zone_type="event_match",
            event_value="trench crossing", threshold_modifiers={},
        )
        mask = _get_zone_mask(sample_df, zone, None, column_mappings)
        assert mask.sum() == 1  # row index 2

    def test_no_kp_column_returns_false(self, sample_df):
        zone = ContextZone(
            id="z1", name="Shore", zone_type="kp_range",
            kp_start=0.0, kp_end=2.0, threshold_modifiers={},
        )
        mask = _get_zone_mask(sample_df, zone, None)
        assert mask.sum() == 0


# ---------------------------------------------------------------------------
# apply_context_zones
# ---------------------------------------------------------------------------

class TestApplyContextZones:
    @patch("app.services.context_zones.run_validation_pipeline")
    def test_single_kp_zone_modifies_thresholds(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """A single KP zone should call pipeline with modified config for zone rows."""
        mock_pipeline.return_value = []

        zone = ContextZone(
            id="z1", name="Shore Approach", zone_type="kp_range",
            kp_start=0.0, kp_end=2.0,
            threshold_modifiers={"dob_max": 1.5},
        )

        apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks, [zone], "kp"
        )

        # Should be called twice: once for zone rows, once for uncovered rows
        assert mock_pipeline.call_count == 2
        # First call should have modified dob_max
        zone_call_config = mock_pipeline.call_args_list[0][0][2]
        assert zone_call_config["dob_max"] == pytest.approx(4.5)

    @patch("app.services.context_zones.run_validation_pipeline")
    def test_rows_outside_zones_use_base_config(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """Rows not in any zone should use the unmodified base config."""
        mock_pipeline.return_value = []

        zone = ContextZone(
            id="z1", name="Shore", zone_type="kp_range",
            kp_start=0.0, kp_end=2.0, threshold_modifiers={"dob_max": 1.5},
        )

        apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks, [zone], "kp"
        )

        # Second call is uncovered rows with base config
        uncovered_call_config = mock_pipeline.call_args_list[1][0][2]
        assert uncovered_call_config["dob_max"] == 3.0

    @patch("app.services.context_zones.run_validation_pipeline")
    def test_event_conditional_zone(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """Event-conditional zone matches rows by event column value."""
        mock_pipeline.return_value = []

        zone = ContextZone(
            id="z2", name="Trench", zone_type="event_match",
            event_value="trench crossing",
            threshold_modifiers={"dob_max": 2.0},
        )

        apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks, [zone], "kp"
        )

        assert mock_pipeline.call_count == 2
        # Zone call should have 1 row (trench crossing row)
        zone_df = mock_pipeline.call_args_list[0][0][0]
        assert len(zone_df) == 1

    @patch("app.services.context_zones.run_validation_pipeline")
    def test_overlapping_zones_first_match_wins(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """First zone claims the row; subsequent overlapping zones skip it."""
        mock_pipeline.return_value = []

        zone1 = ContextZone(
            id="z1", name="Zone A", zone_type="kp_range",
            kp_start=0.0, kp_end=5.0, threshold_modifiers={"dob_max": 1.5},
            sort_order=0,
        )
        zone2 = ContextZone(
            id="z2", name="Zone B", zone_type="kp_range",
            kp_start=1.0, kp_end=10.0, threshold_modifiers={"dob_max": 2.0},
            sort_order=1,
        )

        apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks,
            [zone1, zone2], "kp"
        )

        # Zone A: kp 0.5, 1.0, 1.5, 5.0 (4 rows)
        # Zone B: kp 10.0 only (1.0, 1.5, 5.0 already claimed by zone A)
        # Uncovered: kp 15.0, 20.0
        assert mock_pipeline.call_count == 3
        zone_a_df = mock_pipeline.call_args_list[0][0][0]
        zone_b_df = mock_pipeline.call_args_list[1][0][0]
        assert len(zone_a_df) == 4
        assert len(zone_b_df) == 1

    @patch("app.services.context_zones.run_validation_pipeline")
    def test_empty_zones_returns_base_results(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """Empty zones list should produce same results as base pipeline."""
        from app.validators.base import ValidationIssue, Severity
        expected_issues = [
            ValidationIssue(
                row_number=1, column_name="dob", rule_type="range",
                severity=Severity.WARNING, message="Value out of range",
            )
        ]
        mock_pipeline.return_value = expected_issues

        result = apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks, [], "kp"
        )

        assert mock_pipeline.call_count == 1
        assert len(result) == 1

    @patch("app.services.context_zones.run_validation_pipeline")
    def test_zone_issues_tagged_with_zone_name(
        self, mock_pipeline, sample_df, column_mappings, base_config, enabled_checks
    ):
        """Issues from zone validation should be tagged with [ZoneName]."""
        from app.validators.base import ValidationIssue, Severity
        mock_pipeline.side_effect = [
            [ValidationIssue(
                row_number=1, column_name="dob", rule_type="range",
                severity=Severity.WARNING, message="Value out of range",
            )],
            [],  # uncovered rows
        ]

        zone = ContextZone(
            id="z1", name="Shore Approach", zone_type="kp_range",
            kp_start=0.0, kp_end=2.0, threshold_modifiers={"dob_max": 1.5},
        )

        result = apply_context_zones(
            sample_df, column_mappings, base_config, enabled_checks, [zone], "kp"
        )

        assert len(result) == 1
        assert result[0].message.startswith("[Shore Approach]")


# ---------------------------------------------------------------------------
# Preset zones
# ---------------------------------------------------------------------------

class TestPresetZones:
    def test_preset_zones_contains_all_four_entries(self):
        assert "shore-approach" in PRESET_ZONES
        assert "trench-crossing" in PRESET_ZONES
        assert "j-tube" in PRESET_ZONES
        assert "span" in PRESET_ZONES

    def test_get_preset_zones_returns_dict(self):
        result = get_preset_zones()
        assert isinstance(result, dict)
        assert len(result) == 4

    def test_create_zone_from_preset_valid(self):
        zone = create_zone_from_preset("shore-approach")
        assert zone is not None
        assert zone.name == "Shore Approach"
        assert zone.zone_type == "kp_range"

    def test_create_zone_from_preset_invalid(self):
        zone = create_zone_from_preset("nonexistent")
        assert zone is None

    def test_preset_shore_approach_has_modifiers(self):
        preset = PRESET_ZONES["shore-approach"]
        assert "threshold_modifiers" in preset
        assert "dob_max" in preset["threshold_modifiers"]

    def test_preset_j_tube_tighter_thresholds(self):
        preset = PRESET_ZONES["j-tube"]
        # J-tube should have tighter (< 1.0) modifiers
        assert preset["threshold_modifiers"]["dob_max"] < 1.0
