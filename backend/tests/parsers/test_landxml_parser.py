"""Tests for LandXML parser."""

import os
import pytest

from app.parsers.landxml_parser import parse_landxml
from app.parsers.base import ParseResult


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")


@pytest.fixture
def sample_bytes():
    filepath = os.path.join(FIXTURES_DIR, "sample.xml")
    with open(filepath, "rb") as f:
        return f.read()


class TestParseLandXMLCgPoints:
    def test_cgpoint_extraction(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        assert isinstance(result, ParseResult)
        # 3 CgPoints + 2 alignment points = 5 total
        cgpoint_rows = [r for r in result.rows if r[0] == "CgPoint"]
        assert len(cgpoint_rows) == 3

    def test_cgpoint_values(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        cgpoint_rows = [r for r in result.rows if r[0] == "CgPoint"]
        # First CgPoint: name=PT-001, northing=5000.000, easting=1000.000, elev=10.500
        # Headers: source, point_name, easting, northing, elevation
        name_idx = result.headers.index("point_name")
        easting_idx = result.headers.index("easting")
        northing_idx = result.headers.index("northing")
        elev_idx = result.headers.index("elevation")

        row = cgpoint_rows[0]
        assert row[name_idx] == "PT-001"
        # LandXML CgPoint text is "northing easting elevation"
        assert row[northing_idx] == "5000.000"
        assert row[easting_idx] == "1000.000"
        assert row[elev_idx] == "10.500"

    def test_all_values_strings(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        for row in result.rows:
            for val in row:
                assert isinstance(val, str), f"Expected str, got {type(val)}: {val}"


class TestParseLandXMLAlignment:
    def test_alignment_extraction(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        alignment_rows = [r for r in result.rows if r[0] == "Alignment"]
        # One Line element produces 2 points (start + end)
        assert len(alignment_rows) == 2

    def test_alignment_values(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        alignment_rows = [r for r in result.rows if r[0] == "Alignment"]
        northing_idx = result.headers.index("northing")
        easting_idx = result.headers.index("easting")

        # Start point: 5000.000 1000.000 => northing=5000, easting=1000
        assert alignment_rows[0][northing_idx] == "5000.000"
        assert alignment_rows[0][easting_idx] == "1000.000"
        # End point: 5150.000 1075.000
        assert alignment_rows[1][northing_idx] == "5150.000"
        assert alignment_rows[1][easting_idx] == "1075.000"


class TestParseLandXMLCombined:
    def test_combined_rows(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        # 3 CgPoints + 2 alignment points = 5 total
        assert result.total_rows == 5
        assert len(result.rows) == 5

    def test_source_column(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        source_idx = result.headers.index("source")
        sources = {row[source_idx] for row in result.rows}
        assert "CgPoint" in sources
        assert "Alignment" in sources

    def test_headers(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        assert "source" in result.headers
        assert "point_name" in result.headers
        assert "easting" in result.headers
        assert "northing" in result.headers
        assert "elevation" in result.headers


class TestParseLandXMLMetadata:
    def test_metadata_counts(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        assert result.metadata["cgpoint_count"] == 3
        assert result.metadata["alignment_count"] == 1

    def test_source_format(self, sample_bytes):
        result = parse_landxml(sample_bytes)
        assert result.source_format == "landxml"


class TestParseLandXMLNamespace:
    def test_handles_1_2_namespace(self, sample_bytes):
        """The sample fixture uses 1.2 namespace -- should parse fine."""
        result = parse_landxml(sample_bytes)
        assert result.total_rows > 0

    def test_handles_no_namespace(self):
        """LandXML without namespace should still parse."""
        xml = b"""<?xml version="1.0"?>
        <LandXML version="1.0">
          <CgPoints>
            <CgPoint name="P1">100.0 200.0 5.0</CgPoint>
          </CgPoints>
        </LandXML>"""
        result = parse_landxml(xml)
        assert result.total_rows == 1


class TestParseLandXMLErrors:
    def test_rejects_non_landxml(self):
        xml = b"""<?xml version="1.0"?><root><item>test</item></root>"""
        with pytest.raises(ValueError, match="not a LandXML"):
            parse_landxml(xml)

    def test_rejects_non_xml(self):
        with pytest.raises(Exception):
            parse_landxml(b"this is not xml at all")
