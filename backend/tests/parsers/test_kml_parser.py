"""Tests for KML and KMZ parsers."""

import io
import os
import zipfile

import pytest

from app.parsers.base import ParseResult
from app.parsers.kml_parser import parse_kml, parse_kmz


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


class TestParseKML:
    @pytest.fixture
    def sample_bytes(self):
        filepath = os.path.join(FIXTURES_DIR, "sample.kml")
        with open(filepath, "rb") as f:
            return f.read()

    def test_row_count(self, sample_bytes):
        result = parse_kml(sample_bytes)
        assert result.total_rows == 3
        assert len(result.rows) == 3

    def test_headers_include_core_fields(self, sample_bytes):
        result = parse_kml(sample_bytes)
        assert "name" in result.headers
        assert "description" in result.headers
        assert "longitude" in result.headers
        assert "latitude" in result.headers
        assert "elevation" in result.headers

    def test_extended_data_as_columns(self, sample_bytes):
        result = parse_kml(sample_bytes)
        assert "depth" in result.headers
        depth_idx = result.headers.index("depth")
        assert result.rows[0][depth_idx] == "12.3"

    def test_coordinate_values(self, sample_bytes):
        result = parse_kml(sample_bytes)
        lon_idx = result.headers.index("longitude")
        lat_idx = result.headers.index("latitude")
        elev_idx = result.headers.index("elevation")
        assert result.rows[0][lon_idx] == "1.5"
        assert result.rows[0][lat_idx] == "51.0"
        assert result.rows[0][elev_idx] == "10.5"

    def test_all_values_are_strings(self, sample_bytes):
        result = parse_kml(sample_bytes)
        for row in result.rows:
            for val in row:
                assert isinstance(val, str), f"Expected str, got {type(val)}: {val}"

    def test_source_format(self, sample_bytes):
        result = parse_kml(sample_bytes)
        assert result.source_format == "kml"

    def test_metadata_includes_placemark_count(self, sample_bytes):
        result = parse_kml(sample_bytes)
        assert "placemark_count" in result.metadata
        assert result.metadata["placemark_count"] == 3

    def test_name_values(self, sample_bytes):
        result = parse_kml(sample_bytes)
        name_idx = result.headers.index("name")
        names = [row[name_idx] for row in result.rows]
        assert names == ["WP-001", "WP-002", "WP-003"]


class TestParseKMZ:
    @pytest.fixture
    def sample_kml_bytes(self):
        filepath = os.path.join(FIXTURES_DIR, "sample.kml")
        with open(filepath, "rb") as f:
            return f.read()

    def _make_kmz(self, kml_bytes: bytes) -> bytes:
        """Create an in-memory KMZ from KML bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("doc.kml", kml_bytes)
        return buf.getvalue()

    def test_kmz_decompression(self, sample_kml_bytes):
        kmz_bytes = self._make_kmz(sample_kml_bytes)
        result = parse_kmz(kmz_bytes)
        assert result.total_rows == 3
        assert "name" in result.headers

    def test_kmz_source_format(self, sample_kml_bytes):
        kmz_bytes = self._make_kmz(sample_kml_bytes)
        result = parse_kmz(kmz_bytes)
        assert result.source_format == "kmz"

    def test_kmz_no_kml_raises_error(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("readme.txt", "no kml here")
        with pytest.raises(ValueError, match="does not contain a .kml file"):
            parse_kmz(buf.getvalue())
