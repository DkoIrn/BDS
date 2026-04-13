"""Tests for certificate revocation and public verification endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

CERT_ID = "cccccccc-dddd-eeee-ffff-000000000001"


def _mock_active_cert():
    """Return mock data for an active certificate."""
    return {
        "id": CERT_ID,
        "dataset_name": "North Sea Pipeline Survey 2026.csv",
        "validated_at": "2026-03-15T10:00:00Z",
        "validation_date": "2026-03-15T10:00:00Z",
        "rules_applied": ["Range Check", "Missing Data"],
        "total_issues": 3,
        "pass_rate": 100.0,
        "hmac_hash": "abc123" * 10 + "abcd",
        "org_name": "Test Engineering Ltd",
        "status": "active",
        "revoked_at": None,
        "revocation_reason": None,
    }


def _mock_revoked_cert():
    """Return mock data for a revoked certificate."""
    return {
        "id": CERT_ID,
        "dataset_name": "North Sea Pipeline Survey 2026.csv",
        "validated_at": "2026-03-15T10:00:00Z",
        "validation_date": "2026-03-15T10:00:00Z",
        "rules_applied": ["Range Check"],
        "total_issues": 0,
        "pass_rate": 100.0,
        "hmac_hash": "abc123" * 10 + "abcd",
        "org_name": "Test Engineering Ltd",
        "status": "revoked",
        "revoked_at": "2026-04-01T12:00:00Z",
        "revocation_reason": "Data found to be incorrect",
    }


class TestRevocationEndpoint:
    """Tests for POST /certificates/{id}/revoke."""

    @patch("app.routers.certificates.get_supabase_client")
    def test_revoke_active_certificate(self, mock_get_client):
        """POST /certificates/{id}/revoke with admin auth sets status=revoked."""
        mock_client = MagicMock()

        # Update query returns the updated record
        update_mock = MagicMock()
        update_mock.eq.return_value = update_mock
        update_mock.execute.return_value = MagicMock(
            data=[{"id": CERT_ID, "status": "revoked", "revoked_at": "2026-04-13T10:00:00Z"}]
        )

        table_mock = MagicMock()
        table_mock.update.return_value = update_mock
        mock_client.table.return_value = table_mock
        mock_get_client.return_value = mock_client

        response = client.post(
            f"/api/v1/certificates/{CERT_ID}/revoke",
            json={"reason": "Data found to be incorrect", "user_id": "admin-uuid", "org_id": "org-uuid"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "revoked"
        assert "revoked_at" in data

    @patch("app.routers.certificates.get_supabase_client")
    def test_revoke_already_revoked_returns_404(self, mock_get_client):
        """POST /certificates/{id}/revoke on already-revoked cert returns 404."""
        mock_client = MagicMock()

        # Update query returns empty (no active cert matched)
        update_mock = MagicMock()
        update_mock.eq.return_value = update_mock
        update_mock.execute.return_value = MagicMock(data=[])

        table_mock = MagicMock()
        table_mock.update.return_value = update_mock
        mock_client.table.return_value = table_mock
        mock_get_client.return_value = mock_client

        response = client.post(
            f"/api/v1/certificates/{CERT_ID}/revoke",
            json={"reason": "Duplicate revoke", "user_id": "admin-uuid", "org_id": "org-uuid"},
        )
        assert response.status_code == 404


class TestVerifyEndpoint:
    """Tests for GET /certificates/{id}/verify (public, no auth)."""

    @patch("app.routers.certificates.get_supabase_client")
    def test_verify_active_certificate(self, mock_get_client):
        """GET /certificates/{id}/verify returns active details for valid cert."""
        mock_client = MagicMock()

        select_mock = MagicMock()
        select_mock.eq.return_value = select_mock
        select_mock.single.return_value = select_mock
        select_mock.execute.return_value = MagicMock(data=_mock_active_cert())

        table_mock = MagicMock()
        table_mock.select.return_value = select_mock
        mock_client.table.return_value = table_mock
        mock_get_client.return_value = mock_client

        response = client.get(f"/api/v1/certificates/{CERT_ID}/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert "dataset_name" in data
        assert "pass_rate" in data
        assert response.headers.get("cache-control") == "no-store"

    @patch("app.routers.certificates.get_supabase_client")
    def test_verify_revoked_certificate(self, mock_get_client):
        """GET /certificates/{id}/verify returns revoked status with no dataset details."""
        mock_client = MagicMock()

        select_mock = MagicMock()
        select_mock.eq.return_value = select_mock
        select_mock.single.return_value = select_mock
        select_mock.execute.return_value = MagicMock(data=_mock_revoked_cert())

        table_mock = MagicMock()
        table_mock.select.return_value = select_mock
        mock_client.table.return_value = table_mock
        mock_get_client.return_value = mock_client

        response = client.get(f"/api/v1/certificates/{CERT_ID}/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "revoked"
        assert "revoked_at" in data
        assert "revocation_reason" in data
        # Revoked certs should NOT include dataset details
        assert "dataset_name" not in data
        assert "pass_rate" not in data

    @patch("app.routers.certificates.get_supabase_client")
    def test_verify_unknown_certificate(self, mock_get_client):
        """GET /certificates/{id}/verify returns not_found for unknown ID."""
        mock_client = MagicMock()

        select_mock = MagicMock()
        select_mock.eq.return_value = select_mock
        select_mock.single.return_value = select_mock
        # Simulate not-found by raising an exception (PostgREST returns 406 for .single() with 0 rows)
        select_mock.execute.side_effect = Exception("Not found")

        table_mock = MagicMock()
        table_mock.select.return_value = select_mock
        mock_client.table.return_value = table_mock
        mock_get_client.return_value = mock_client

        response = client.get(f"/api/v1/certificates/nonexistent-uuid/verify")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_found"
