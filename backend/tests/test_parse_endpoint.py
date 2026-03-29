"""Tests for the /api/v1/parse endpoint logic."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.routers.parsing import parse_dataset_file, ParseRequest


# --- Helpers ---

def _make_geojson_bytes() -> bytes:
    """Return valid GeoJSON FeatureCollection bytes."""
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [1.5, 51.5, 3.2]},
                "properties": {"name": "Pt-A", "depth": "4.5"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [1.6, 51.6, 3.3]},
                "properties": {"name": "Pt-B", "depth": "4.6"},
            },
        ],
    }
    return json.dumps(fc).encode()


def _mock_supabase(dataset_record: dict | None, file_bytes: bytes | None):
    """Create a mock Supabase client with table/storage helpers."""
    mock = MagicMock()

    # table().select().eq().single().execute()
    select_result = MagicMock()
    select_result.data = dataset_record

    single_mock = MagicMock()
    single_mock.execute.return_value = select_result

    eq_mock = MagicMock()
    eq_mock.single.return_value = single_mock

    select_mock = MagicMock()
    select_mock.eq.return_value = eq_mock

    table_mock = MagicMock()
    table_mock.select.return_value = select_mock

    # table().update().eq().execute()
    update_eq_mock = MagicMock()
    update_eq_mock.execute.return_value = MagicMock()
    update_mock = MagicMock()
    update_mock.eq.return_value = update_eq_mock
    table_mock.update.return_value = update_mock

    mock.table.return_value = table_mock

    # storage.from_().download()
    bucket_mock = MagicMock()
    bucket_mock.download.return_value = file_bytes
    storage_from = MagicMock()
    storage_from.return_value = bucket_mock
    mock.storage.from_ = storage_from

    return mock


# --- Tests ---

class TestParseDatasetFile:
    """Test the parse_dataset_file function directly (no HTTP layer)."""

    @patch("app.routers.parsing.get_supabase_client")
    def test_success_geojson(self, mock_get_client):
        dataset = {
            "id": "ds-001",
            "file_name": "survey.geojson",
            "storage_path": "user-123/survey.geojson",
            "status": "uploaded",
        }
        file_bytes = _make_geojson_bytes()
        mock_client = _mock_supabase(dataset, file_bytes)
        mock_get_client.return_value = mock_client

        result = parse_dataset_file("ds-001")

        assert "columns" in result
        assert "preview" in result
        assert "headerRow" in result
        assert result["headerRow"] == 0
        assert "totalRows" in result
        assert result["totalRows"] > 0
        assert "warnings" in result

        # Should have called update with status="parsed"
        update_call = mock_client.table.return_value.update
        update_call.assert_called()
        update_data = update_call.call_args[0][0]
        assert update_data["status"] == "parsed"
        assert update_data["header_row_index"] == 0
        assert update_data["total_rows"] == result["totalRows"]
        assert isinstance(update_data["column_mappings"], list)

    @patch("app.routers.parsing.get_supabase_client")
    def test_dataset_not_found(self, mock_get_client):
        mock_client = _mock_supabase(None, None)
        mock_get_client.return_value = mock_client

        with pytest.raises(Exception, match="not found"):
            parse_dataset_file("nonexistent")

    @patch("app.routers.parsing.get_supabase_client")
    def test_unsupported_format_sets_error(self, mock_get_client):
        dataset = {
            "id": "ds-002",
            "file_name": "data.csv",
            "storage_path": "user-123/data.csv",
            "status": "uploaded",
        }
        mock_client = _mock_supabase(dataset, b"some,csv,data")
        mock_get_client.return_value = mock_client

        with pytest.raises(Exception):
            parse_dataset_file("ds-002")

        # Should have set status to error
        update_call = mock_client.table.return_value.update
        update_call.assert_called()
        update_data = update_call.call_args[0][0]
        assert update_data["status"] == "error"

    @patch("app.routers.parsing.get_supabase_client")
    def test_preview_limited_to_250_rows(self, mock_get_client):
        """Preview should contain at most 250 rows."""
        # Create GeoJSON with 300 points
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [i * 0.01, 50 + i * 0.01]},
                "properties": {"id": str(i)},
            }
            for i in range(300)
        ]
        fc = {"type": "FeatureCollection", "features": features}
        file_bytes = json.dumps(fc).encode()

        dataset = {
            "id": "ds-003",
            "file_name": "big.geojson",
            "storage_path": "user-123/big.geojson",
            "status": "uploaded",
        }
        mock_client = _mock_supabase(dataset, file_bytes)
        mock_get_client.return_value = mock_client

        result = parse_dataset_file("ds-003")

        assert len(result["preview"]) <= 250
        assert result["totalRows"] == 300

    @patch("app.routers.parsing.get_supabase_client")
    def test_column_mappings_format(self, mock_get_client):
        """Column mappings should match ColumnMapping structure."""
        dataset = {
            "id": "ds-004",
            "file_name": "test.geojson",
            "storage_path": "user-123/test.geojson",
            "status": "uploaded",
        }
        file_bytes = _make_geojson_bytes()
        mock_client = _mock_supabase(dataset, file_bytes)
        mock_get_client.return_value = mock_client

        result = parse_dataset_file("ds-004")

        # Check column mappings stored in update call
        update_data = mock_client.table.return_value.update.call_args[0][0]
        mappings = update_data["column_mappings"]
        assert len(mappings) > 0
        for m in mappings:
            assert "index" in m
            assert "originalName" in m
            assert "mappedType" in m
            assert "ignored" in m


class TestParseEndpoint:
    """Test the HTTP endpoint via FastAPI TestClient."""

    @patch("app.routers.parsing.get_supabase_client")
    def test_missing_dataset_id_returns_400(self, mock_get_client):
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.post("/api/v1/parse", json={})
        assert response.status_code == 422 or response.status_code == 400

    @patch("app.routers.parsing.get_supabase_client")
    def test_dataset_not_found_returns_404(self, mock_get_client):
        from fastapi.testclient import TestClient
        from app.main import app

        mock_client = _mock_supabase(None, None)
        mock_get_client.return_value = mock_client

        response = client = TestClient(app)
        response = client.post("/api/v1/parse", json={"dataset_id": "nonexistent"})
        assert response.status_code == 404
