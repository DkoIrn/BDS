"""Tests for DXF parser."""

import io
import os
import pytest

from app.parsers.dxf_parser import parse_dxf
from app.parsers.base import ParseResult


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


@pytest.fixture
def sample_bytes():
    filepath = os.path.join(FIXTURES_DIR, "sample.dxf")
    with open(filepath, "rb") as f:
        return f.read()


class TestParseDxfPoint:
    def test_point_entity_extraction(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        assert isinstance(result, ParseResult)
        point_rows = [r for r in result.rows if r[0] == "POINT"]
        assert len(point_rows) == 1

    def test_point_values(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        point_rows = [r for r in result.rows if r[0] == "POINT"]
        row = point_rows[0]
        # Headers: entity_type, layer, easting, northing, elevation
        assert row[0] == "POINT"
        assert row[1] == "Survey"
        assert row[2] == "100.0"
        assert row[3] == "200.0"
        assert row[4] == "5.0"


class TestParseDxfLine:
    def test_line_produces_two_rows(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        line_rows = [r for r in result.rows if r[0] == "LINE"]
        assert len(line_rows) == 2

    def test_line_start_and_end(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        line_rows = [r for r in result.rows if r[0] == "LINE"]
        # Start point
        assert line_rows[0][2] == "100.0"
        assert line_rows[0][3] == "200.0"
        assert line_rows[0][4] == "5.0"
        # End point
        assert line_rows[1][2] == "150.0"
        assert line_rows[1][3] == "250.0"
        assert line_rows[1][4] == "6.0"

    def test_line_layer(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        line_rows = [r for r in result.rows if r[0] == "LINE"]
        assert line_rows[0][1] == "Centerline"


class TestParseDxfLwpolyline:
    def test_lwpolyline_vertex_count(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        poly_rows = [r for r in result.rows if r[0] == "LWPOLYLINE"]
        assert len(poly_rows) == 3

    def test_lwpolyline_layer(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        poly_rows = [r for r in result.rows if r[0] == "LWPOLYLINE"]
        assert poly_rows[0][1] == "Boundary"

    def test_lwpolyline_coordinates(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        poly_rows = [r for r in result.rows if r[0] == "LWPOLYLINE"]
        assert poly_rows[0][2] == "10.0"
        assert poly_rows[0][3] == "20.0"


class TestParseDxfMetadata:
    def test_metadata_layers(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        assert "layers" in result.metadata
        layers = result.metadata["layers"]
        assert "Survey" in layers
        assert "Centerline" in layers
        assert "Boundary" in layers

    def test_source_format(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        assert result.source_format == "dxf"

    def test_headers(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        assert result.headers == ["entity_type", "layer", "easting", "northing", "elevation"]


class TestParseDxfAllStrings:
    def test_all_values_are_strings(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        for row in result.rows:
            for val in row:
                assert isinstance(val, str), f"Expected str, got {type(val)}: {val}"


class TestParseDxfTotalRows:
    def test_total_rows(self, sample_bytes):
        result = parse_dxf(sample_bytes)
        # 1 POINT + 2 LINE + 3 LWPOLYLINE = 6
        assert result.total_rows == 6
        assert len(result.rows) == 6
