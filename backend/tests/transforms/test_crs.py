"""Tests for CRS coordinate transformation."""

import pytest

from app.parsers.base import ParseResult
from app.transforms.crs import transform_crs


def _make_result(headers, rows):
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="csv",
    )


class TestTransformCrs:
    def test_wgs84_to_osgb36(self):
        """WGS84 London coords should transform to ~530000, ~180000 in OSGB36."""
        result = _make_result(
            ["longitude", "latitude", "name"],
            [["-0.1278", "51.5074", "London"]],
        )
        transformed, warnings = transform_crs(result, 4326, 27700)
        assert len(transformed.rows) == 1
        x = float(transformed.rows[0][0])
        y = float(transformed.rows[0][1])
        assert 529000 < x < 531000, f"Expected ~530000 easting, got {x}"
        assert 179000 < y < 181000, f"Expected ~180000 northing, got {y}"
        # Non-coord columns unchanged
        assert transformed.rows[0][2] == "London"

    def test_preserves_row_count(self):
        result = _make_result(
            ["lon", "lat"],
            [["1.0", "2.0"], ["3.0", "4.0"], ["5.0", "6.0"]],
        )
        transformed, warnings = transform_crs(result, 4326, 32631)
        assert len(transformed.rows) == 3

    def test_no_coord_columns_returns_warning(self):
        result = _make_result(
            ["name", "value"],
            [["A", "1"], ["B", "2"]],
        )
        transformed, warnings = transform_crs(result, 4326, 27700)
        assert len(warnings) > 0
        assert any("coordinate" in w.lower() or "column" in w.lower() for w in warnings)
        # Original data unchanged
        assert transformed.rows == result.rows

    def test_same_headers(self):
        result = _make_result(
            ["longitude", "latitude", "depth"],
            [["-0.1278", "51.5074", "5.2"]],
        )
        transformed, _ = transform_crs(result, 4326, 27700)
        assert transformed.headers == result.headers
