"""Tests for ParseResult base and GeoJSON parser."""

import json
import os
import pytest

from app.parsers.base import ParseResult, flatten_geometry
from app.parsers.geojson_parser import parse_geojson


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


# --- ParseResult dataclass tests ---


class TestParseResult:
    def test_construction(self):
        result = ParseResult(
            headers=["col1", "col2"],
            rows=[["a", "b"], ["c", "d"]],
            total_rows=2,
            metadata={"key": "value"},
            warnings=[],
            source_format="test",
        )
        assert result.headers == ["col1", "col2"]
        assert result.rows == [["a", "b"], ["c", "d"]]
        assert result.total_rows == 2
        assert result.metadata == {"key": "value"}
        assert result.warnings == []
        assert result.source_format == "test"

    def test_defaults(self):
        result = ParseResult(
            headers=["h"],
            rows=[["v"]],
            total_rows=1,
            metadata={},
            warnings=[],
            source_format="x",
        )
        assert isinstance(result.warnings, list)


# --- flatten_geometry tests ---


class TestFlattenGeometry:
    def test_point_3d(self):
        rows = flatten_geometry("Point", [1.0, 2.0, 3.0])
        assert len(rows) == 1
        assert rows[0]["longitude"] == "1.0"
        assert rows[0]["latitude"] == "2.0"
        assert rows[0]["elevation"] == "3.0"

    def test_point_2d(self):
        rows = flatten_geometry("Point", [1.0, 2.0])
        assert len(rows) == 1
        assert rows[0]["longitude"] == "1.0"
        assert rows[0]["latitude"] == "2.0"
        assert "elevation" not in rows[0] or rows[0]["elevation"] == ""

    def test_linestring(self):
        rows = flatten_geometry("LineString", [[1, 2], [3, 4]])
        assert len(rows) == 2
        assert rows[0]["point_index"] == "0"
        assert rows[0]["longitude"] == "1"
        assert rows[0]["latitude"] == "2"
        assert rows[1]["point_index"] == "1"
        assert rows[1]["longitude"] == "3"
        assert rows[1]["latitude"] == "4"

    def test_polygon(self):
        ring = [[0, 0], [1, 0], [1, 1], [0, 0]]
        rows = flatten_geometry("Polygon", [ring])
        assert len(rows) == 4
        assert rows[0]["ring"] == "0"
        assert rows[0]["point_index"] == "0"
        assert rows[0]["longitude"] == "0"
        assert rows[0]["latitude"] == "0"


# --- parse_geojson tests ---


class TestParseGeoJSON:
    @pytest.fixture
    def sample_bytes(self):
        filepath = os.path.join(FIXTURES_DIR, "sample.geojson")
        with open(filepath, "rb") as f:
            return f.read()

    def test_feature_collection_row_count(self, sample_bytes):
        result = parse_geojson(sample_bytes)
        assert result.total_rows == 3
        assert len(result.rows) == 3

    def test_headers_include_geometry_type_and_properties(self, sample_bytes):
        result = parse_geojson(sample_bytes)
        assert "geometry_type" in result.headers
        assert "longitude" in result.headers
        assert "latitude" in result.headers
        assert "elevation" in result.headers
        assert "name" in result.headers
        assert "depth" in result.headers
        assert "description" in result.headers

    def test_all_values_are_strings(self, sample_bytes):
        result = parse_geojson(sample_bytes)
        for row in result.rows:
            for val in row:
                assert isinstance(val, str), f"Expected str, got {type(val)}: {val}"

    def test_source_format(self, sample_bytes):
        result = parse_geojson(sample_bytes)
        assert result.source_format == "geojson"

    def test_metadata_includes_feature_count(self, sample_bytes):
        result = parse_geojson(sample_bytes)
        assert "feature_count" in result.metadata
        assert result.metadata["feature_count"] == 3

    def test_single_feature(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [5.0, 10.0]},
            "properties": {"name": "solo"},
        }
        result = parse_geojson(json.dumps(feature).encode())
        assert result.total_rows >= 1
        assert "name" in result.headers

    def test_mixed_geometry_types(self):
        fc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1, 2]},
                    "properties": {"name": "pt"},
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[3, 4], [5, 6]],
                    },
                    "properties": {"name": "line"},
                },
            ],
        }
        result = parse_geojson(json.dumps(fc).encode())
        assert "geometry_type" in result.headers
        assert result.total_rows == 3  # 1 point + 2 linestring points
