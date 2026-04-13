"""Tests for QC Certificate PDF generation, HMAC signing, and QR code embedding."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.certificate_builder import (
    compute_certificate_hash,
    generate_certificate_pdf,
    generate_certificate_qr,
    add_qr_to_certificate,
)

client = TestClient(app)

TEST_SECRET = "test-secret-key-for-certificates"


@pytest.fixture
def cert_data_pass():
    """Certificate data for a passed validation run."""
    return {
        "certificate_id": "cccccccc-dddd-eeee-ffff-000000000001",
        "dataset_name": "North Sea Pipeline Survey 2026.csv",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "run_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "validation_date": "2026-03-15T10:00:00Z",
        "rules_applied": ["Range Check", "Missing Data", "KP Monotonicity", "Cross-Column Consistency"],
        "verdict": "PASS",
        "pass_rate": 100.0,
        "total_issues": 3,
        "critical_count": 0,
        "warning_count": 2,
        "info_count": 1,
        "org_name": "Test Engineering Ltd",
        "generated_by": "user-uuid-1234",
    }


@pytest.fixture
def cert_data_fail():
    """Certificate data for a failed validation run."""
    return {
        "certificate_id": "cccccccc-dddd-eeee-ffff-000000000002",
        "dataset_name": "Failed Pipeline Data.csv",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "run_id": "aaaaaaaa-bbbb-cccc-dddd-ffffffffffff",
        "validation_date": "2026-03-15T10:00:00Z",
        "rules_applied": ["Range Check", "Missing Data"],
        "verdict": "FAIL",
        "pass_rate": 85.0,
        "total_issues": 10,
        "critical_count": 2,
        "warning_count": 5,
        "info_count": 3,
        "org_name": "Test Engineering Ltd",
        "generated_by": "user-uuid-1234",
    }


class TestCertificatePDFGeneration:
    """Tests for certificate PDF builder."""

    def test_generate_certificate_pdf(self, cert_data_pass):
        """generate_certificate_pdf returns bytes starting with %PDF."""
        hmac_hash = compute_certificate_hash(cert_data_pass, TEST_SECRET)
        pdf_bytes = generate_certificate_pdf(cert_data_pass, hmac_hash)
        assert pdf_bytes[:5] == b"%PDF-"

    def test_certificate_contains_required_fields(self, cert_data_pass):
        """PDF text contains dataset name, validation date, rules summary, verdict, and HMAC hash string."""
        hmac_hash = compute_certificate_hash(cert_data_pass, TEST_SECRET)
        pdf_bytes = generate_certificate_pdf(cert_data_pass, hmac_hash)

        assert b"North Sea Pipeline Survey" in pdf_bytes
        assert b"2026" in pdf_bytes
        assert b"Range Check" in pdf_bytes
        assert b"KP Monotonicity" in pdf_bytes
        assert b"PASS" in pdf_bytes
        assert hmac_hash[:16].encode() in pdf_bytes

    def test_certificate_rejects_fail_verdict(self, cert_data_fail):
        """generate_certificate_pdf raises ValueError when verdict is FAIL (critical_count > 0)."""
        hmac_hash = "fakehash"
        with pytest.raises(ValueError, match="critical"):
            generate_certificate_pdf(cert_data_fail, hmac_hash)

    def test_sanitize_unicode(self, cert_data_pass):
        """Non-Latin-1 characters in dataset name do not crash PDF generation."""
        cert_data_pass["dataset_name"] = "Pipeline\u2014Survey\u201cTest\u201d.csv"
        hmac_hash = compute_certificate_hash(cert_data_pass, TEST_SECRET)
        pdf_bytes = generate_certificate_pdf(cert_data_pass, hmac_hash)
        assert pdf_bytes[:5] == b"%PDF-"


class TestHMACSigning:
    """Tests for HMAC-SHA256 certificate hash computation."""

    def test_hmac_deterministic(self, cert_data_pass):
        """compute_certificate_hash with same input and secret returns identical hex digest on two calls."""
        hash1 = compute_certificate_hash(cert_data_pass, TEST_SECRET)
        hash2 = compute_certificate_hash(cert_data_pass, TEST_SECRET)
        assert hash1 == hash2
        assert len(hash1) == 64

    def test_hmac_changes_on_tamper(self, cert_data_pass):
        """Changing any field in cert_data produces a different hash."""
        original_hash = compute_certificate_hash(cert_data_pass, TEST_SECRET)

        tampered = dict(cert_data_pass)
        tampered["pass_rate"] = 99.0
        assert original_hash != compute_certificate_hash(tampered, TEST_SECRET)

        tampered2 = dict(cert_data_pass)
        tampered2["dataset_name"] = "Different Dataset.csv"
        assert original_hash != compute_certificate_hash(tampered2, TEST_SECRET)

        tampered3 = dict(cert_data_pass)
        tampered3["verdict"] = "FAIL"
        assert original_hash != compute_certificate_hash(tampered3, TEST_SECRET)


class TestQRCodeGeneration:
    """Tests for QR code generation and PDF embedding."""

    def test_generate_certificate_qr_returns_pil_image(self):
        """generate_certificate_qr returns a PIL Image with valid QR data."""
        from PIL import Image

        url = "https://truqc.co.uk/verify/cccccccc-dddd-eeee-ffff-000000000001"
        qr_img = generate_certificate_qr(url)
        assert isinstance(qr_img, Image.Image)
        assert qr_img.size[0] > 0
        assert qr_img.size[1] > 0

    def test_qr_image_has_minimum_dimensions(self):
        """QR code image has non-trivial dimensions (QR codes require min size)."""
        cert_id = "cccccccc-dddd-eeee-ffff-000000000001"
        url = f"https://truqc.co.uk/verify/{cert_id}"
        qr_img = generate_certificate_qr(url)
        assert qr_img.size[0] >= 100
        assert qr_img.size[1] >= 100

    def test_add_qr_to_certificate_embeds_scan_text(self):
        """add_qr_to_certificate adds 'Scan to verify' caption text to PDF."""
        from fpdf import FPDF

        pdf = FPDF()
        pdf.set_compression(False)
        pdf.add_page()
        cert_id = "cccccccc-dddd-eeee-ffff-000000000001"

        add_qr_to_certificate(pdf, cert_id)

        pdf_bytes = pdf.output()
        assert b"Scan to verify" in pdf_bytes

    def test_add_qr_to_certificate_embeds_url(self):
        """add_qr_to_certificate adds the plain text verify URL to PDF."""
        from fpdf import FPDF

        pdf = FPDF()
        pdf.set_compression(False)
        pdf.add_page()
        cert_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

        add_qr_to_certificate(pdf, cert_id)

        pdf_bytes = pdf.output()
        assert b"truqc.co.uk/verify" in pdf_bytes
        assert cert_id.encode() in pdf_bytes


def _mock_supabase_for_pass():
    """Create a mock Supabase client that returns a passed validation run."""
    mock_client = MagicMock()

    run_data = {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "status": "completed",
        "run_at": "2026-03-15T10:00:00Z",
        "pass_rate": 100.0,
        "total_issues": 3,
        "critical_count": 0,
        "warning_count": 2,
        "info_count": 1,
        "config_snapshot": {"profile_name": "Pipeline QC", "rules": [{"name": "Range Check"}, {"name": "Missing Data"}]},
    }

    ds_data = {"file_name": "Test Pipeline Survey.csv"}
    certs_data = []

    def table_side_effect(name):
        tq = MagicMock()
        if name == "validation_runs":
            tq.select.return_value = tq
            tq.eq.return_value = tq
            tq.single.return_value = tq
            tq.execute.return_value = MagicMock(data=run_data)
        elif name == "datasets":
            tq.select.return_value = tq
            tq.eq.return_value = tq
            tq.single.return_value = tq
            tq.execute.return_value = MagicMock(data=ds_data)
        elif name == "certificates":
            select_mock = MagicMock()
            select_mock.eq.return_value = select_mock
            select_mock.execute.return_value = MagicMock(data=certs_data)
            tq.select.return_value = select_mock

            insert_mock = MagicMock()
            insert_mock.execute.return_value = MagicMock(data=[{}])
            tq.insert.return_value = insert_mock
        return tq

    mock_client.table.side_effect = table_side_effect
    return mock_client


def _mock_supabase_for_fail():
    """Create a mock Supabase client that returns a failed validation run."""
    mock_client = MagicMock()

    run_data = {
        "id": "aaaaaaaa-bbbb-cccc-dddd-ffffffffffff",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "status": "completed",
        "run_at": "2026-03-15T10:00:00Z",
        "pass_rate": 85.0,
        "total_issues": 10,
        "critical_count": 2,
        "warning_count": 5,
        "info_count": 3,
        "config_snapshot": {},
    }

    def table_side_effect(name):
        tq = MagicMock()
        if name == "validation_runs":
            tq.select.return_value = tq
            tq.eq.return_value = tq
            tq.single.return_value = tq
            tq.execute.return_value = MagicMock(data=run_data)
        return tq

    mock_client.table.side_effect = table_side_effect
    return mock_client


class TestCertificateEndpoint:
    """Tests for the certificate generation API endpoint."""

    @patch("app.routers.certificates.get_supabase_client")
    def test_certificate_endpoint_pass(self, mock_get_client):
        """Endpoint returns 200 + PDF for a passed validation run."""
        mock_get_client.return_value = _mock_supabase_for_pass()
        response = client.post(
            "/api/v1/certificate/generate/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            json={
                "user_id": "user-uuid-1234",
                "org_id": "org-uuid-5678",
                "org_name": "Test Engineering Ltd",
            },
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content[:5] == b"%PDF-"

    @patch("app.routers.certificates.get_supabase_client")
    def test_certificate_endpoint_rejects_fail(self, mock_get_client):
        """Endpoint returns 400 for a run with critical issues."""
        mock_get_client.return_value = _mock_supabase_for_fail()
        response = client.post(
            "/api/v1/certificate/generate/aaaaaaaa-bbbb-cccc-dddd-ffffffffffff",
            json={
                "user_id": "user-uuid-1234",
                "org_id": "org-uuid-5678",
                "org_name": "Test Engineering Ltd",
            },
        )
        assert response.status_code == 400
        assert "critical" in response.json()["detail"].lower()
