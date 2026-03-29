"""Tests for GeoJSON writer -- converts ParseResult to GeoJSON FeatureCollection."""

import json

from app.parsers.base import ParseResult
from app.writers.geojson_writer import write_geojson


def _make_result(headers: list[str], rows: list[list[str]]) -> ParseResult:
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="test",
    )


def test_with_lon_lat_coordinates():
    result = _make_result(
        ["longitude", "latitude", "name"],
        [["1.5", "2.5", "A"], ["3.5", "4.5", "B"]],
    )
    out_bytes, warnings = write_geojson(result)
    fc = json.loads(out_bytes)
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2
    feat = fc["features"][0]
    assert feat["geometry"]["type"] == "Point"
    assert feat["geometry"]["coordinates"] == [1.5, 2.5]
    assert feat["properties"]["name"] == "A"


def test_no_coordinate_columns():
    result = _make_result(["name", "value"], [["A", "1"]])
    out_bytes, warnings = write_geojson(result)
    fc = json.loads(out_bytes)
    assert fc["features"][0]["geometry"] is None
    assert any("No coordinate columns found" in w for w in warnings)


def test_partial_bad_coordinates():
    result = _make_result(
        ["longitude", "latitude"],
        [["1.0", "2.0"], ["bad", "3.0"], ["4.0", "5.0"]],
    )
    out_bytes, warnings = write_geojson(result)
    fc = json.loads(out_bytes)
    # Should have 2 features (skipped the bad row)
    assert len(fc["features"]) == 2
    assert any("skipped" in w.lower() for w in warnings)


def test_column_name_variants_xy():
    result = _make_result(["x", "y"], [["10.0", "20.0"]])
    out_bytes, _ = write_geojson(result)
    fc = json.loads(out_bytes)
    assert fc["features"][0]["geometry"]["coordinates"] == [10.0, 20.0]


def test_column_name_variants_easting_northing():
    result = _make_result(["easting", "northing"], [["500000", "6000000"]])
    out_bytes, _ = write_geojson(result)
    fc = json.loads(out_bytes)
    assert fc["features"][0]["geometry"]["coordinates"] == [500000.0, 6000000.0]


def test_with_elevation():
    result = _make_result(
        ["lon", "lat", "elevation"],
        [["1.0", "2.0", "100.0"]],
    )
    out_bytes, _ = write_geojson(result)
    fc = json.loads(out_bytes)
    assert fc["features"][0]["geometry"]["coordinates"] == [1.0, 2.0, 100.0]


def test_non_coordinate_columns_become_properties():
    result = _make_result(
        ["longitude", "latitude", "name", "depth"],
        [["1.0", "2.0", "P1", "50"]],
    )
    out_bytes, _ = write_geojson(result)
    fc = json.loads(out_bytes)
    props = fc["features"][0]["properties"]
    assert props["name"] == "P1"
    assert props["depth"] == "50"
    assert "longitude" not in props
    assert "latitude" not in props
