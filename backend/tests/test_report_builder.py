"""Tests for QC PDF report generation."""

import pytest

from app.services.report_builder import generate_pdf_report


@pytest.fixture
def run_data_pass():
    """Validation run with no critical issues -- should produce PASS verdict."""
    return {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "run_at": "2026-03-15T10:00:00Z",
        "total_issues": 3,
        "critical_count": 0,
        "warning_count": 2,
        "info_count": 1,
        "pass_rate": 100.0,
        "status": "completed",
    }


@pytest.fixture
def run_data_fail():
    """Validation run with critical issues -- should produce FAIL verdict."""
    return {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "dataset_id": "11111111-2222-3333-4444-555555555555",
        "run_at": "2026-03-15T10:00:00Z",
        "total_issues": 10,
        "critical_count": 3,
        "warning_count": 5,
        "info_count": 2,
        "pass_rate": 85.0,
        "status": "completed",
    }


@pytest.fixture
def sample_issues():
    """A small set of validation issues for testing."""
    return [
        {
            "id": "issue-1",
            "run_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "dataset_id": "11111111-2222-3333-4444-555555555555",
            "row_number": 3,
            "column_name": "dob",
            "rule_type": "range_check",
            "severity": "critical",
            "message": "DOB value 15.2 exceeds maximum 10.0",
            "expected": "0.0 - 10.0",
            "actual": "15.2",
            "kp_value": 0.030,
        },
        {
            "id": "issue-2",
            "run_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "dataset_id": "11111111-2222-3333-4444-555555555555",
            "row_number": 7,
            "column_name": "doc",
            "rule_type": "outlier_zscore",
            "severity": "warning",
            "message": "DOC value is a statistical outlier (z-score: 3.5)",
            "expected": "within 3.0 std devs",
            "actual": "3.5 std devs",
            "kp_value": 0.070,
        },
        {
            "id": "issue-3",
            "run_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "dataset_id": "11111111-2222-3333-4444-555555555555",
            "row_number": 12,
            "column_name": "kp",
            "rule_type": "kp_gap",
            "severity": "info",
            "message": "KP gap 0.15 exceeds threshold 0.1",
            "expected": "gap <= 0.1",
            "actual": "0.15",
            "kp_value": 0.120,
        },
    ]


class TestPDFGeneration:
    """Tests for generate_pdf_report function."""

    def test_pdf_magic_bytes(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert pdf_bytes[:5] == b"%PDF-"

    def test_pdf_has_summary_section(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        # PDF text content check -- fpdf2 produces text that can be searched
        assert b"Summary" in pdf_bytes

    def test_pdf_has_methodology_section(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert b"Methodology" in pdf_bytes

    def test_pdf_has_issues_table(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_fail, sample_issues, "test_dataset.csv")
        # Check for table header text
        assert b"Row" in pdf_bytes
        assert b"Severity" in pdf_bytes

    def test_pdf_pass_verdict(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert b"PASS" in pdf_bytes

    def test_pdf_fail_verdict(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_fail, sample_issues, "test_dataset.csv")
        assert b"FAIL" in pdf_bytes

    def test_pdf_truncation(self, run_data_fail):
        """Run with >500 issues should produce truncation note."""
        many_issues = [
            {
                "row_number": i,
                "column_name": "dob",
                "rule_type": "range_check",
                "severity": "warning",
                "message": f"Issue {i}",
                "expected": "0-10",
                "actual": "11",
                "kp_value": i * 0.01,
            }
            for i in range(1, 602)  # 601 issues
        ]
        run_data_fail["total_issues"] = 601
        pdf_bytes = generate_pdf_report(run_data_fail, many_issues, "test_dataset.csv")
        assert b"additional issues not shown" in pdf_bytes

    def test_pdf_nonzero_size(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert len(pdf_bytes) > 100
