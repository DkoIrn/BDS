"""Tests for parser dispatch registry."""

import json
import pytest

from app.parsers import dispatch_parser, PARSER_REGISTRY, ParseResult


class TestParserRegistry:
    def test_geojson_extension(self):
        assert ".geojson" in PARSER_REGISTRY

    def test_json_extension(self):
        assert ".json" in PARSER_REGISTRY

    def test_zip_extension(self):
        assert ".zip" in PARSER_REGISTRY

    def test_kml_extension(self):
        assert ".kml" in PARSER_REGISTRY

    def test_kmz_extension(self):
        assert ".kmz" in PARSER_REGISTRY

    def test_xml_extension(self):
        assert ".xml" in PARSER_REGISTRY

    def test_dxf_extension(self):
        assert ".dxf" in PARSER_REGISTRY


class TestDispatchParser:
    def test_routes_geojson(self):
        fc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1, 2]},
                    "properties": {"name": "test"},
                }
            ],
        }
        result = dispatch_parser(json.dumps(fc).encode(), "test.geojson")
        assert isinstance(result, ParseResult)
        assert result.source_format == "geojson"

    def test_routes_json_as_geojson(self):
        fc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1, 2]},
                    "properties": {},
                }
            ],
        }
        result = dispatch_parser(json.dumps(fc).encode(), "data.json")
        assert result.source_format == "geojson"

    def test_routes_xml_as_landxml(self):
        xml = b"""<?xml version="1.0"?>
        <LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
          <CgPoints>
            <CgPoint name="P1">100.0 200.0 5.0</CgPoint>
          </CgPoints>
        </LandXML>"""
        result = dispatch_parser(xml, "survey.xml")
        assert result.source_format == "landxml"

    def test_routes_dxf(self):
        import os
        fixtures = os.path.join(os.path.dirname(__file__), "..", "fixtures")
        with open(os.path.join(fixtures, "sample.dxf"), "rb") as f:
            dxf_bytes = f.read()
        result = dispatch_parser(dxf_bytes, "drawing.dxf")
        assert result.source_format == "dxf"

    def test_unsupported_extension_raises(self):
        with pytest.raises(ValueError, match="Unsupported file format"):
            dispatch_parser(b"data", "file.csv")

    def test_case_insensitive_extension(self):
        fc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1, 2]},
                    "properties": {},
                }
            ],
        }
        result = dispatch_parser(json.dumps(fc).encode(), "TEST.GEOJSON")
        assert result.source_format == "geojson"

    def test_parse_result_reexport(self):
        """ParseResult should be importable from app.parsers for convenience."""
        assert ParseResult is not None
