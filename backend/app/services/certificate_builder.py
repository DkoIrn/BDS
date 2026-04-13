"""QC Certificate PDF generation and HMAC-SHA256 signing.

Generates branded, formal single-page QC Validation Certificates with:
- TruQC branded header matching report style
- Dataset information, validation summary, rules applied
- HMAC-SHA256 integrity hash for tamper evidence
- Certification statement and signatory line
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import tempfile

import qrcode
from fpdf import FPDF


# Brand colors (mirrored from report_builder.py)
BRAND_DARK = (15, 23, 42)       # slate-900
BRAND_MID = (51, 65, 85)        # slate-700
BRAND_LIGHT = (148, 163, 184)   # slate-400
BRAND_TEAL = (20, 184, 166)     # teal-500
WHITE = (255, 255, 255)
LIGHT_GRAY = (248, 250, 252)    # slate-50
PASS_GREEN = (22, 163, 74)      # green-600
PASS_BG = (220, 252, 231)       # green-100


def _sanitize(text: str) -> str:
    """Replace Unicode characters that Helvetica can't encode."""
    return (
        text
        .replace("\u2014", "--")   # em dash
        .replace("\u2013", "-")    # en dash
        .replace("\u2018", "'")    # left single quote
        .replace("\u2019", "'")    # right single quote
        .replace("\u201c", '"')    # left double quote
        .replace("\u201d", '"')    # right double quote
        .replace("\u2264", "<=")   # <=
        .replace("\u2265", ">=")   # >=
        .replace("\u2260", "!=")   # !=
    )


def _embed_logo(pdf: FPDF, logo_bytes: bytes, max_height: float = 10.0) -> None:
    """Embed a logo image in the PDF header from raw bytes."""
    from PIL import Image

    img = Image.open(io.BytesIO(logo_bytes))
    w, h = img.size
    aspect = w / h
    logo_h = min(max_height, h)
    logo_w = logo_h * aspect

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    try:
        img.save(tmp, format="PNG")
        tmp.close()
        pdf.image(tmp_path, x=pdf.l_margin, y=2, h=logo_h)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def generate_certificate_qr(verify_url: str) -> "Image.Image":
    """Create a QR code image encoding the given verify URL.

    Args:
        verify_url: Full URL to encode (e.g. https://truqc.co.uk/verify/{id}).

    Returns:
        PIL Image of the QR code.
    """
    from PIL import Image as _PILImage  # noqa: F811

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(verify_url)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").get_image()


def add_qr_to_certificate(pdf: FPDF, certificate_id: str) -> None:
    """Embed a QR code at top-right of the first PDF page with caption text.

    Places a QR code encoding ``https://truqc.co.uk/verify/{certificate_id}``
    at position (175, 15) with width 25 mm.  Below the QR code it prints
    "Scan to verify" (7 pt, gray) and the plain-text URL (5 pt).

    Args:
        pdf: An FPDF instance (must already have at least one page).
        certificate_id: UUID string of the certificate.
    """
    verify_url = f"https://truqc.co.uk/verify/{certificate_id}"
    qr_img = generate_certificate_qr(verify_url)

    # Save QR image to a temp file for fpdf2 embedding
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    try:
        qr_img.save(tmp, format="PNG")
        tmp.close()

        # Top-right position: x = 210 - 25 - 10 = 175, y = 15, w = 25mm
        qr_x = 175
        qr_y = 15
        qr_w = 25

        pdf.image(tmp_path, x=qr_x, y=qr_y, w=qr_w)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # "Scan to verify" caption below QR code
    caption_y = qr_y + qr_w + 1
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*BRAND_LIGHT)
    # Center text under QR code
    caption_x = qr_x
    caption_w = qr_w
    pdf.set_xy(caption_x, caption_y)
    pdf.cell(caption_w, 3, "Scan to verify", align="C")

    # Plain text URL below caption
    url_y = caption_y + 3.5
    pdf.set_font("Helvetica", "", 5)
    pdf.set_xy(caption_x, url_y)
    pdf.cell(caption_w, 3, f"truqc.co.uk/verify/{certificate_id}", align="C")


def compute_certificate_hash(cert_data: dict, secret_key: str) -> str:
    """Compute HMAC-SHA256 over canonical certificate data.

    Builds a canonical dict with a fixed set of keys, serializes to
    deterministic JSON, and returns the HMAC-SHA256 hex digest.

    Args:
        cert_data: Certificate data dict with all required fields.
        secret_key: HMAC secret key string.

    Returns:
        64-character hex digest string.
    """
    canonical = {
        "certificate_id": cert_data.get("certificate_id", ""),
        "run_id": cert_data.get("run_id", ""),
        "dataset_id": cert_data.get("dataset_id", ""),
        "dataset_name": cert_data.get("dataset_name", ""),
        "validation_date": cert_data.get("validation_date", ""),
        "rules_applied": cert_data.get("rules_applied", []),
        "verdict": cert_data.get("verdict", ""),
        "pass_rate": cert_data.get("pass_rate", 0.0),
        "total_issues": cert_data.get("total_issues", 0),
        "critical_count": cert_data.get("critical_count", 0),
        "warning_count": cert_data.get("warning_count", 0),
        "info_count": cert_data.get("info_count", 0),
    }
    canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        secret_key.encode("utf-8"),
        canonical_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class QCCertificate(FPDF):
    """Custom FPDF subclass for QC Validation Certificates."""

    def __init__(self, logo_bytes: bytes | None = None):
        super().__init__()
        self.set_compression(False)
        self.logo_bytes = logo_bytes
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        # Dark top bar
        self.set_fill_color(*BRAND_DARK)
        self.rect(0, 0, 210, 14, "F")
        # Teal accent line
        self.set_fill_color(*BRAND_TEAL)
        self.rect(0, 14, 210, 0.8, "F")

        self.set_y(3)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*WHITE)

        if self.logo_bytes:
            _embed_logo(self, self.logo_bytes)
            self.set_xy(35, 3)
            self.cell(0, 8, "TruQC  |  QC Validation Certificate", align="L")
        else:
            self.cell(0, 8, "TruQC  |  QC Validation Certificate", align="C")
        self.set_y(20)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*BRAND_LIGHT)
        self.cell(0, 10, f"Generated by TruQC  |  truqc.co.uk  |  Page {self.page_no()}/{{nb}}", align="C")


def generate_certificate_pdf(
    cert_data: dict,
    hmac_hash: str,
    logo_bytes: bytes | None = None,
) -> bytes:
    """Generate a QC Validation Certificate PDF.

    Args:
        cert_data: Certificate data dict with all required fields.
        hmac_hash: Pre-computed HMAC-SHA256 hex digest.
        logo_bytes: Optional org logo PNG bytes for header.

    Returns:
        PDF file bytes.

    Raises:
        ValueError: If cert_data has critical_count > 0.
    """
    if cert_data.get("critical_count", 0) > 0:
        raise ValueError(
            f"Cannot generate certificate: {cert_data['critical_count']} critical "
            f"issues found. Certificates are only issued for passed validation runs."
        )

    pdf = QCCertificate(logo_bytes=logo_bytes)
    pdf.alias_nb_pages()
    pdf.add_page()

    # ── Title ──────────────────────────────────────────────
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*BRAND_DARK)
    pdf.cell(0, 12, "QC Validation Certificate", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Thin teal divider
    pdf.set_draw_color(*BRAND_TEAL)
    pdf.set_line_width(0.6)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(6)

    # ── Certificate ID ─────────────────────────────────────
    cert_id = cert_data.get("certificate_id", "N/A")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*BRAND_LIGHT)
    pdf.cell(0, 5, f"Certificate ID: {cert_id}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── Dataset Information ────────────────────────────────
    _section_heading(pdf, "Dataset Information")

    dataset_name = _sanitize(cert_data.get("dataset_name", "Unknown"))
    validation_date = cert_data.get("validation_date", "N/A")
    # Format date nicely if ISO format
    if "T" in str(validation_date):
        validation_date = str(validation_date).replace("T", " ").split(".")[0][:19]
    org_name = _sanitize(cert_data.get("org_name", ""))

    _kv_row(pdf, "Dataset", dataset_name)
    _kv_row(pdf, "Validation Date", str(validation_date))
    if org_name:
        _kv_row(pdf, "Organisation", org_name)
    pdf.ln(4)

    # ── Validation Summary ─────────────────────────────────
    _section_heading(pdf, "Validation Summary")

    # Verdict badge
    pdf.set_fill_color(*PASS_BG)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*PASS_GREEN)
    badge_y = pdf.get_y()
    pdf.rect(pdf.l_margin, badge_y, 190, 10, "F")
    pdf.cell(0, 10, f"Verdict: {cert_data.get('verdict', 'PASS')}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    pass_rate = cert_data.get("pass_rate", 0.0)
    total_issues = cert_data.get("total_issues", 0)
    critical_count = cert_data.get("critical_count", 0)
    warning_count = cert_data.get("warning_count", 0)
    info_count = cert_data.get("info_count", 0)

    _kv_row(pdf, "Pass Rate", f"{pass_rate:.1f}%")
    _kv_row(pdf, "Total Issues", str(total_issues))
    _kv_row(pdf, "Critical", str(critical_count))
    _kv_row(pdf, "Warnings", str(warning_count))
    _kv_row(pdf, "Informational", str(info_count))
    pdf.ln(4)

    # ── Rules Applied ──────────────────────────────────────
    rules = cert_data.get("rules_applied", [])
    if rules:
        _section_heading(pdf, "Rules Applied")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*BRAND_MID)
        for rule in rules:
            pdf.cell(6, 5, "-")
            pdf.cell(0, 5, _sanitize(str(rule)), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # ── Certification Statement ────────────────────────────
    _section_heading(pdf, "Certification Statement")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BRAND_MID)
    statement = (
        "This certificate confirms that the above dataset has been validated "
        "and meets quality requirements as assessed by the TruQC platform. "
        "The validation was performed using automated engineering-grade QC checks "
        "and no critical issues were identified."
    )
    pdf.multi_cell(0, 5, statement)
    pdf.ln(6)

    # ── HMAC Integrity Hash ────────────────────────────────
    _section_heading(pdf, "Integrity Verification")
    pdf.set_font("Courier", "", 7)
    pdf.set_text_color(*BRAND_DARK)
    pdf.cell(0, 5, hmac_hash, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(*BRAND_LIGHT)
    pdf.cell(0, 4, "HMAC-SHA256 -- This hash can be used to verify certificate authenticity", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # ── Signatory ──────────────────────────────────────────
    pdf.set_draw_color(*BRAND_LIGHT)
    pdf.line(pdf.l_margin + 30, pdf.get_y(), pdf.l_margin + 160, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*BRAND_DARK)
    pdf.cell(0, 5, "Certified by TruQC Automated QC System", align="C", new_x="LMARGIN", new_y="NEXT")

    # Date of certification
    issue_date = cert_data.get("validation_date", "N/A")
    if "T" in str(issue_date):
        issue_date = str(issue_date).split("T")[0]
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*BRAND_MID)
    pdf.cell(0, 5, f"Date: {issue_date}", align="C", new_x="LMARGIN", new_y="NEXT")

    return pdf.output()


def _section_heading(pdf: FPDF, title: str) -> None:
    """Render a certificate section heading with teal underline."""
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*BRAND_DARK)
    pdf.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*BRAND_TEAL)
    pdf.set_line_width(0.4)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 50, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(3)


def _kv_row(pdf: FPDF, label: str, value: str) -> None:
    """Render a key-value row in the certificate."""
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*BRAND_MID)
    pdf.cell(45, 6, _sanitize(label))
    pdf.set_text_color(*BRAND_DARK)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 6, _sanitize(value), new_x="LMARGIN", new_y="NEXT")
