"""Tests for default validation profile templates and resolve_config helper."""

import pytest

from app.models.schemas import ProfileConfig
from app.services.templates import DEFAULT_TEMPLATES, TEMPLATE_METADATA, resolve_config


class TestDefaultTemplates:
    def test_four_templates_exist(self):
        assert len(DEFAULT_TEMPLATES) == 4
        assert set(DEFAULT_TEMPLATES.keys()) == {
            "dob-survey", "doc-survey", "top-survey", "general-survey",
        }

    def test_all_templates_are_profile_configs(self):
        for key, config in DEFAULT_TEMPLATES.items():
            assert isinstance(config, ProfileConfig), f"{key} is not a ProfileConfig"

    def test_dob_template_has_correct_dob_range(self):
        dob = DEFAULT_TEMPLATES["dob-survey"]
        assert dob.ranges["dob"].min == 0
        assert dob.ranges["dob"].max == 5

    def test_doc_template_has_correct_doc_range(self):
        doc = DEFAULT_TEMPLATES["doc-survey"]
        assert doc.ranges["doc"].min == 0
        assert doc.ranges["doc"].max == 3

    def test_top_template_has_correct_top_range(self):
        top = DEFAULT_TEMPLATES["top-survey"]
        assert top.ranges["top"].min == -200
        assert top.ranges["top"].max == 200

    def test_general_template_has_all_range_types(self):
        gen = DEFAULT_TEMPLATES["general-survey"]
        expected_types = {
            "dob", "doc", "top", "depth", "elevation",
            "easting", "northing", "latitude", "longitude",
        }
        assert set(gen.ranges.keys()) == expected_types

    def test_templates_have_distinct_thresholds(self):
        """Each template has different range configurations."""
        dob_ranges = set(DEFAULT_TEMPLATES["dob-survey"].ranges.keys())
        doc_ranges = set(DEFAULT_TEMPLATES["doc-survey"].ranges.keys())
        top_ranges = set(DEFAULT_TEMPLATES["top-survey"].ranges.keys())
        gen_ranges = set(DEFAULT_TEMPLATES["general-survey"].ranges.keys())
        # General has more range types than specific templates
        assert len(gen_ranges) > len(dob_ranges)
        assert len(gen_ranges) > len(doc_ranges)
        assert len(gen_ranges) > len(top_ranges)

    def test_general_template_all_checks_enabled(self):
        gen = DEFAULT_TEMPLATES["general-survey"]
        checks = gen.enabled_checks
        assert checks.range_check is True
        assert checks.missing_data is True
        assert checks.duplicate_rows is True
        assert checks.outliers_zscore is True


class TestResolveConfig:
    def test_dob_template_flat_config(self):
        """DOB template config can be converted to flat config dict."""
        config = DEFAULT_TEMPLATES["dob-survey"]
        flat, checks = resolve_config(config)
        assert flat["dob_min"] == 0
        assert flat["dob_max"] == 5
        assert flat["zscore_threshold"] == 3.0
        assert flat["iqr_multiplier"] == 1.5

    def test_resolve_config_returns_enabled_checks(self):
        config = DEFAULT_TEMPLATES["general-survey"]
        flat, checks = resolve_config(config)
        assert checks["range_check"] is True
        assert checks["missing_data"] is True
        assert checks["duplicate_rows"] is True

    def test_resolve_config_flat_keys(self):
        """Flat config has keys like dob_min, dob_max, zscore_threshold."""
        config = DEFAULT_TEMPLATES["general-survey"]
        flat, _ = resolve_config(config)
        assert "dob_min" in flat
        assert "dob_max" in flat
        assert "zscore_threshold" in flat
        assert "iqr_multiplier" in flat
        assert "kp_gap_max" in flat
        assert "duplicate_kp_tolerance" in flat


class TestTemplateMetadata:
    def test_metadata_has_four_entries(self):
        assert len(TEMPLATE_METADATA) == 4

    def test_metadata_has_required_fields(self):
        for meta in TEMPLATE_METADATA:
            assert "id" in meta
            assert "name" in meta
            assert "survey_type" in meta
            assert "description" in meta
