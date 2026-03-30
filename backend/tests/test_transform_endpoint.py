"""Integration tests for /api/v1/transform/* endpoints."""

import io
import json
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")


# --- CRS endpoint ---


class TestCrsEndpoint:
    def test_crs_transform_csv(self):
        """CRS transform with explicit source and target EPSG."""
        csv_data = _csv_bytes("longitude,latitude,name\n-0.1278,51.5074,London\n")
        response = client.post(
            "/api/v1/transform/crs",
            data={"source_epsg": "4326", "target_epsg": "27700"},
            files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        assert "x-source-crs" in response.headers
        assert response.headers["x-source-crs"] == "4326"
        assert response.headers["x-target-crs"] == "27700"

    def test_crs_auto_detect_source(self):
        """Source CRS auto-detected from WGS84 coordinate ranges."""
        csv_data = _csv_bytes("lon,lat\n1.5,51.5\n2.0,52.0\n")
        response = client.post(
            "/api/v1/transform/crs",
            data={"target_epsg": "27700"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        assert response.headers["x-source-crs"] == "4326"

    def test_crs_default_format_matches_input(self):
        """Without target_format, CSV in -> CSV out."""
        csv_data = _csv_bytes("longitude,latitude\n1.0,51.0\n")
        response = client.post(
            "/api/v1/transform/crs",
            data={"target_epsg": "27700"},
            files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "test.csv" in response.headers["content-disposition"]

    def test_crs_missing_target_epsg(self):
        csv_data = _csv_bytes("lon,lat\n1.0,2.0\n")
        response = client.post(
            "/api/v1/transform/crs",
            data={},
            files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 422  # validation error


# --- Merge endpoint ---


class TestMergeEndpoint:
    def test_merge_two_csvs(self):
        csv_a = _csv_bytes("x,y\n1,2\n")
        csv_b = _csv_bytes("x,y\n3,4\n")
        response = client.post(
            "/api/v1/transform/merge",
            files=[
                ("files", ("a.csv", io.BytesIO(csv_a), "text/csv")),
                ("files", ("b.csv", io.BytesIO(csv_b), "text/csv")),
            ],
        )
        assert response.status_code == 200
        assert response.headers["x-row-count"] == "2"

    def test_merge_single_file_rejected(self):
        csv_a = _csv_bytes("x,y\n1,2\n")
        response = client.post(
            "/api/v1/transform/merge",
            files=[
                ("files", ("a.csv", io.BytesIO(csv_a), "text/csv")),
            ],
        )
        assert response.status_code == 400
        assert "2 files" in response.json()["detail"].lower()

    def test_merge_default_format(self):
        csv_a = _csv_bytes("x,y\n1,2\n")
        csv_b = _csv_bytes("x,y\n3,4\n")
        response = client.post(
            "/api/v1/transform/merge",
            files=[
                ("files", ("a.csv", io.BytesIO(csv_a), "text/csv")),
                ("files", ("b.csv", io.BytesIO(csv_b), "text/csv")),
            ],
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]


# --- Split endpoint ---


class TestSplitEndpoint:
    def test_split_by_column_zip(self):
        csv_data = _csv_bytes("type,val\nA,1\nB,2\nA,3\n")
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "column", "column_name": "type"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        assert "application/zip" in response.headers["content-type"]
        # Verify it's a valid ZIP
        zf = zipfile.ZipFile(io.BytesIO(response.content))
        assert len(zf.namelist()) == 2  # A and B

    def test_split_by_column_single_value(self):
        csv_data = _csv_bytes("type,val\nA,1\nB,2\nA,3\n")
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "column", "column_name": "type", "single_value": "A"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        # Should be a single file, not ZIP
        assert "application/zip" not in response.headers.get("content-type", "")
        assert "text/csv" in response.headers["content-type"]

    def test_split_by_kp(self):
        csv_data = _csv_bytes("kp,depth\n1,5\n3,6\n6,7\n8,8\n")
        ranges_json = json.dumps([[0, 5], [5, 10]])
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "kp", "ranges": ranges_json},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 200
        assert "application/zip" in response.headers["content-type"]

    def test_split_invalid_mode(self):
        csv_data = _csv_bytes("x,y\n1,2\n")
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "invalid"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()

    def test_split_missing_column_name(self):
        csv_data = _csv_bytes("type,val\nA,1\n")
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "column"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 400

    def test_split_single_value_not_found(self):
        csv_data = _csv_bytes("type,val\nA,1\nB,2\n")
        response = client.post(
            "/api/v1/transform/split",
            data={"mode": "column", "column_name": "type", "single_value": "C"},
            files={"file": ("data.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert response.status_code == 404
