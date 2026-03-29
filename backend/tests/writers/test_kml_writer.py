"""Tests for KML writer -- converts ParseResult to KML XML."""

from lxml import etree

from app.parsers.base import ParseResult
from app.writers.kml_writer import write_kml

KML_NS = "http://www.opengis.net/kml/2.2"


def _make_result(headers: list[str], rows: list[list[str]]) -> ParseResult:
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="test",
    )


def test_with_coordinates():
    result = _make_result(
        ["name", "longitude", "latitude"],
        [["Point A", "1.5", "2.5"], ["Point B", "3.5", "4.5"]],
    )
    out_bytes, warnings = write_kml(result)
    root = etree.fromstring(out_bytes)
    assert root.tag == f"{{{KML_NS}}}kml"
    placemarks = root.findall(f".//{{{KML_NS}}}Placemark")
    assert len(placemarks) == 2
    coords_text = placemarks[0].find(f".//{{{KML_NS}}}coordinates").text.strip()
    assert "1.5" in coords_text
    assert "2.5" in coords_text


def test_without_coordinates():
    result = _make_result(["name", "value"], [["A", "1"]])
    out_bytes, warnings = write_kml(result)
    root = etree.fromstring(out_bytes)
    placemarks = root.findall(f".//{{{KML_NS}}}Placemark")
    assert len(placemarks) == 1
    # No Point element
    point = placemarks[0].find(f".//{{{KML_NS}}}Point")
    assert point is None
    assert any("No coordinate columns" in w for w in warnings)


def test_with_elevation():
    result = _make_result(
        ["longitude", "latitude", "elevation"],
        [["1.0", "2.0", "100.0"]],
    )
    out_bytes, _ = write_kml(result)
    root = etree.fromstring(out_bytes)
    coords_text = root.find(f".//{{{KML_NS}}}coordinates").text.strip()
    assert "1.0,2.0,100.0" == coords_text


def test_crs_warning():
    result = _make_result(["longitude", "latitude"], [["1.0", "2.0"]])
    _, warnings = write_kml(result)
    assert any("WGS84" in w for w in warnings)


def test_extended_data():
    result = _make_result(
        ["name", "longitude", "latitude", "depth"],
        [["P1", "1.0", "2.0", "50"]],
    )
    out_bytes, _ = write_kml(result)
    root = etree.fromstring(out_bytes)
    ext_data = root.find(f".//{{{KML_NS}}}ExtendedData")
    assert ext_data is not None
    data_elements = ext_data.findall(f"{{{KML_NS}}}Data")
    names = [d.get("name") for d in data_elements]
    assert "depth" in names


def test_xml_declaration():
    result = _make_result(["longitude", "latitude"], [["1.0", "2.0"]])
    out_bytes, _ = write_kml(result)
    assert out_bytes.startswith(b"<?xml")
