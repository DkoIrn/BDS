"""Tests for Shapefile ZIP parser."""

import io
import os
import zipfile

import pytest
import shapefile

from app.parsers.base import ParseResult
from app.parsers.shapefile_parser import parse_shapefile_zip


def _create_shapefile_zip() -> bytes:
    """Create an in-memory shapefile ZIP with 3 Point records."""
    # Use pyshp Writer to create shapefile components in memory
    shp_buf = io.BytesIO()
    shx_buf = io.BytesIO()
    dbf_buf = io.BytesIO()

    w = shapefile.Writer(shp=shp_buf, shx=shx_buf, dbf=dbf_buf)
    w.field("name", "C", size=40)
    w.field("depth", "N", decimal=2, size=10)

    w.point(1.5, 51.0)
    w.record("WP-001", 12.3)

    w.point(1.6, 51.1)
    w.record("WP-002", 14.7)

    w.point(1.7, 51.2)
    w.record("WP-003", 8.1)

    w.close()

    # Package into a ZIP
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("data.shp", shp_buf.getvalue())
        zf.writestr("data.shx", shx_buf.getvalue())
        zf.writestr("data.dbf", dbf_buf.getvalue())
    return zip_buf.getvalue()


def _create_no_shp_zip() -> bytes:
    """Create a ZIP with no .shp file."""
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("readme.txt", "no shapefile here")
    return zip_buf.getvalue()


class TestParseShapefileZip:
    @pytest.fixture
    def shp_zip_bytes(self):
        return _create_shapefile_zip()

    def test_row_count(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        assert result.total_rows == 3
        assert len(result.rows) == 3

    def test_headers_include_attributes_and_coords(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        assert "easting" in result.headers
        assert "northing" in result.headers
        assert "name" in result.headers
        assert "depth" in result.headers

    def test_all_values_are_strings(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        for row in result.rows:
            for val in row:
                assert isinstance(val, str), f"Expected str, got {type(val)}: {val}"

    def test_source_format(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        assert result.source_format == "shapefile"

    def test_metadata_includes_shape_type_and_count(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        assert "shape_type" in result.metadata
        assert "record_count" in result.metadata
        assert result.metadata["record_count"] == 3

    def test_missing_shp_raises_value_error(self):
        bad_zip = _create_no_shp_zip()
        with pytest.raises(ValueError, match="does not contain a .shp file"):
            parse_shapefile_zip(bad_zip)

    def test_coordinate_values(self, shp_zip_bytes):
        result = parse_shapefile_zip(shp_zip_bytes)
        easting_idx = result.headers.index("easting")
        northing_idx = result.headers.index("northing")
        # First point: (1.5, 51.0)
        assert result.rows[0][easting_idx] == "1.5"
        assert result.rows[0][northing_idx] == "51.0"
