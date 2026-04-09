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


@pytest.fixture
def issues_no_kp():
    """Issues without kp_value fields."""
    return [
        {
            "id": "issue-nk-1",
            "row_number": 5,
            "column_name": "depth",
            "rule_type": "range_check",
            "severity": "warning",
            "message": "Depth value out of range",
        },
    ]


@pytest.fixture
def triage_counts():
    """Sample triage counts."""
    return {"accepted": 5, "rejected": 2, "deferred": 1}


class TestPDFGeneration:
    """Tests for generate_pdf_report function (legacy/backward compat)."""

    def test_pdf_magic_bytes(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert pdf_bytes[:5] == b"%PDF-"

    def test_pdf_has_summary_section(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert b"Summary" in pdf_bytes

    def test_pdf_has_methodology_section(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert b"Methodology" in pdf_bytes

    def test_pdf_has_issues_table(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_fail, sample_issues, "test_dataset.csv")
        assert b"Row" in pdf_bytes
        assert b"Severity" in pdf_bytes

    def test_pdf_pass_verdict(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert b"PASS" in pdf_bytes

    def test_pdf_fail_verdict(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_fail, sample_issues, "test_dataset.csv")
        assert b"FAIL" in pdf_bytes

    def test_pdf_truncation(self, run_data_fail):
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
            for i in range(1, 602)
        ]
        run_data_fail["total_issues"] = 601
        pdf_bytes = generate_pdf_report(run_data_fail, many_issues, "test_dataset.csv")
        assert b"additional issues not shown" in pdf_bytes

    def test_pdf_nonzero_size(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(run_data_pass, sample_issues, "test_dataset.csv")
        assert len(pdf_bytes) > 100


class TestExecutiveMode:
    """Tests for Executive mode report."""

    def test_executive_mode_header(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv", mode="executive"
        )
        assert b"QC Summary Report" in pdf_bytes

    def test_executive_no_methodology(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv", mode="executive"
        )
        assert b"Methodology" not in pdf_bytes

    def test_executive_no_detailed_issues(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_fail, sample_issues, "test_dataset.csv", mode="executive"
        )
        assert b"Detailed Issues" not in pdf_bytes

    def test_executive_has_top_issues(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_fail, sample_issues, "test_dataset.csv", mode="executive"
        )
        assert b"Top Issues" in pdf_bytes

    def test_executive_concise(self, run_data_pass, sample_issues):
        """Executive mode should be concise (1-2 pages)."""
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv", mode="executive"
        )
        # Count page markers in PDF -- each page after first has /Page type
        page_count = pdf_bytes.count(b"/Type /Page") - pdf_bytes.count(b"/Type /Pages")
        assert page_count <= 2, f"Executive report has {page_count} pages, expected <= 2"


class TestTechnicalMode:
    """Tests for Technical mode report."""

    def test_technical_mode_header(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv", mode="technical"
        )
        assert b"QC Technical Report" in pdf_bytes

    def test_technical_has_methodology(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv", mode="technical"
        )
        assert b"Methodology" in pdf_bytes

    def test_technical_has_detailed_issues(self, run_data_fail, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_fail, sample_issues, "test_dataset.csv", mode="technical"
        )
        assert b"Detailed Issues" in pdf_bytes

    def test_default_mode_is_technical(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv"
        )
        assert b"QC Technical Report" in pdf_bytes


class TestStatementOfQuality:
    """Tests for Statement of Quality section."""

    def test_soq_in_both_modes(self, run_data_pass, sample_issues):
        for mode in ["executive", "technical"]:
            pdf_bytes = generate_pdf_report(
                run_data_pass, sample_issues, "test_dataset.csv", mode=mode
            )
            assert b"Statement of Quality" in pdf_bytes, f"SoQ missing in {mode} mode"

    def test_soq_with_triage(self, run_data_pass, sample_issues, triage_counts):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv",
            mode="technical", triage_counts=triage_counts,
        )
        assert b"accepted" in pdf_bytes
        assert b"rejected" in pdf_bytes

    def test_soq_without_triage(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv",
            mode="technical", triage_counts=None,
        )
        assert b"accepted" not in pdf_bytes


class TestBranding:
    """Tests for TruQC branding."""

    def test_truqc_in_pdf(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv"
        )
        assert b"TruQC" in pdf_bytes

    def test_dataflow_not_in_pdf(self, run_data_pass, sample_issues):
        pdf_bytes = generate_pdf_report(
            run_data_pass, sample_issues, "test_dataset.csv"
        )
        assert b"DataFlow" not in pdf_bytes


class TestKPDensityInReport:
    """Tests for KP density chart presence in reports."""

    def test_kp_no_data_note(self, run_data_pass, issues_no_kp):
        pdf_bytes = generate_pdf_report(
            run_data_pass, issues_no_kp, "test_dataset.csv", mode="technical"
        )
        assert b"KP density chart unavailable" in pdf_bytes
