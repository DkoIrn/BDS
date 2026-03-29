"""Integration tests for POST /api/v1/convert endpoint."""

import io
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")


def _geojson_bytes(features: list[dict]) -> bytes:
    fc = {"type": "FeatureCollection", "features": features}
    return json.dumps(fc).encode("utf-8")


# --- CSV -> GeoJSON ---

def test_csv_to_geojson():
    csv_data = _csv_bytes("longitude,latitude,name\n1.5,2.5,A\n3.5,4.5,B\n")
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "geojson"},
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/geo+json"
    assert "test.geojson" in response.headers["content-disposition"]
    fc = response.json()
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2


# --- GeoJSON -> CSV ---

def test_geojson_to_csv():
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [1.0, 2.0]},
            "properties": {"name": "P1"},
        }
    ]
    geojson_data = _geojson_bytes(features)
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "csv"},
        files={"file": ("data.geojson", io.BytesIO(geojson_data), "application/json")},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "data.csv" in response.headers["content-disposition"]
    lines = response.text.strip().split("\n")
    assert len(lines) >= 2  # header + at least 1 data row


# --- GeoJSON -> KML ---

def test_geojson_to_kml():
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [1.0, 2.0]},
            "properties": {"name": "P1"},
        }
    ]
    geojson_data = _geojson_bytes(features)
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "kml"},
        files={"file": ("data.geojson", io.BytesIO(geojson_data), "application/json")},
    )
    assert response.status_code == 200
    assert "kml" in response.headers["content-type"]
    assert "data.kml" in response.headers["content-disposition"]
    assert b"<?xml" in response.content


# --- Unsupported target_format -> 400 ---

def test_unsupported_target_format():
    csv_data = _csv_bytes("a,b\n1,2\n")
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "pdf"},
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert response.status_code == 400
    assert "pdf" in response.json()["detail"].lower()


# --- Unparseable file -> 400 ---

def test_unparseable_file():
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "csv"},
        files={"file": ("data.txt", io.BytesIO(b"\x00\x01\x02"), "application/octet-stream")},
    )
    assert response.status_code == 400


# --- Response headers ---

def test_response_headers():
    csv_data = _csv_bytes("longitude,latitude\n1.0,2.0\n3.0,4.0\n")
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "geojson"},
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert response.status_code == 200
    assert "x-row-count" in response.headers
    assert response.headers["x-row-count"] == "2"
    assert "x-source-format" in response.headers


# --- Partial conversion with warnings ---

def test_partial_conversion_warnings():
    csv_data = _csv_bytes("longitude,latitude\n1.0,2.0\nbad,3.0\n4.0,5.0\n")
    response = client.post(
        "/api/v1/convert",
        data={"target_format": "geojson"},
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert response.status_code == 200
    warnings_header = response.headers.get("x-conversion-warnings", "")
    assert "skipped" in warnings_header.lower()
    fc = response.json()
    assert len(fc["features"]) == 2  # bad row excluded
