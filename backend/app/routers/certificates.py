"""FastAPI router for QC Validation Certificate generation, revocation, and verification."""

import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_supabase_client
from app.services.certificate_builder import (
    compute_certificate_hash,
    generate_certificate_pdf,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["certificates"])


class CertificateRequest(BaseModel):
    """POST body for certificate generation."""

    user_id: str
    org_id: str
    org_name: str


class RevokeRequest(BaseModel):
    """POST body for certificate revocation."""

    reason: str | None = None
    user_id: str
    org_id: str


@router.post("/certificate/generate/{run_id}")
def generate_certificate(run_id: str, body: CertificateRequest):
    """Generate a tamper-evident QC Validation Certificate PDF.

    Fetches the validation run, checks eligibility (no critical issues),
    persists a certificate record, and returns a branded PDF.
    Re-generating for the same run returns the existing certificate.
    """
    supabase = get_supabase_client()

    # Fetch validation run
    try:
        run_result = (
            supabase.table("validation_runs")
            .select("*")
            .eq("id", run_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Validation run not found")

    if not run_result.data:
        raise HTTPException(status_code=404, detail="Validation run not found")

    run_data = run_result.data

    # Check eligibility: must be completed with no critical issues
    if run_data.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Certificate can only be generated for completed validation runs",
        )

    critical_count = run_data.get("critical_count", 0) or 0
    if critical_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Certificate can only be generated for passed validation runs (no critical issues)",
        )

    # Check if certificate already exists for this run
    existing = (
        supabase.table("certificates")
        .select("*")
        .eq("run_id", run_id)
        .execute()
    )

    dataset_id = run_data.get("dataset_id", "")

    # Fetch dataset name
    dataset_name = "Unknown Dataset"
    if dataset_id:
        try:
            ds_result = (
                supabase.table("datasets")
                .select("file_name")
                .eq("id", dataset_id)
                .single()
                .execute()
            )
            if ds_result.data:
                dataset_name = ds_result.data.get("file_name", dataset_name)
        except Exception:
            pass

    # Fetch rules applied from run config
    rules_applied = []
    config_snapshot = run_data.get("config_snapshot") or {}
    if isinstance(config_snapshot, dict):
        rules = config_snapshot.get("rules") or config_snapshot.get("checks") or []
        if isinstance(rules, list):
            for rule in rules:
                if isinstance(rule, dict):
                    rules_applied.append(rule.get("name", rule.get("type", "Unknown Rule")))
                elif isinstance(rule, str):
                    rules_applied.append(rule)
    if not rules_applied:
        profile_name = config_snapshot.get("profile_name", "Default Profile")
        rules_applied = [profile_name]

    if existing.data and len(existing.data) > 0:
        # Re-generate PDF from stored record (same hash)
        cert_record = existing.data[0]
        cert_data = {
            "certificate_id": cert_record["id"],
            "run_id": run_id,
            "dataset_id": dataset_id,
            "dataset_name": cert_record.get("dataset_name", dataset_name),
            "validation_date": cert_record.get("validation_date", run_data.get("run_at", "")),
            "rules_applied": cert_record.get("rules_applied", rules_applied),
            "verdict": cert_record.get("verdict", "PASS"),
            "pass_rate": cert_record.get("pass_rate", 0.0),
            "total_issues": cert_record.get("total_issues", 0),
            "critical_count": cert_record.get("critical_count", 0),
            "warning_count": cert_record.get("warning_count", 0),
            "info_count": cert_record.get("info_count", 0),
            "org_name": body.org_name,
            "generated_by": body.user_id,
        }
        hmac_hash = cert_record["hmac_hash"]
    else:
        # Build new certificate
        certificate_id = str(uuid.uuid4())
        cert_data = {
            "certificate_id": certificate_id,
            "run_id": run_id,
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "validation_date": run_data.get("run_at", ""),
            "rules_applied": rules_applied,
            "verdict": "PASS",
            "pass_rate": run_data.get("pass_rate", 100.0),
            "total_issues": run_data.get("total_issues", 0),
            "critical_count": critical_count,
            "warning_count": run_data.get("warning_count", 0),
            "info_count": run_data.get("info_count", 0),
            "org_name": body.org_name,
            "generated_by": body.user_id,
        }

        # Compute HMAC hash
        hmac_secret = settings.certificate_hmac_secret
        if not hmac_secret:
            logger.warning(
                "CERTIFICATE_HMAC_SECRET not set — using development fallback. "
                "Set this in production!"
            )
            hmac_secret = "development-only-not-for-production"

        hmac_hash = compute_certificate_hash(cert_data, hmac_secret)

        # Persist certificate record
        try:
            supabase.table("certificates").insert({
                "id": certificate_id,
                "run_id": run_id,
                "dataset_id": dataset_id,
                "org_id": body.org_id,
                "generated_by": body.user_id,
                "dataset_name": dataset_name,
                "validation_date": run_data.get("run_at", ""),
                "rules_applied": rules_applied,
                "verdict": "PASS",
                "pass_rate": run_data.get("pass_rate", 100.0),
                "total_issues": run_data.get("total_issues", 0),
                "critical_count": critical_count,
                "warning_count": run_data.get("warning_count", 0),
                "info_count": run_data.get("info_count", 0),
                "hmac_hash": hmac_hash,
            }).execute()
        except Exception as e:
            logger.error("Failed to persist certificate record: %s", str(e))
            raise HTTPException(status_code=500, detail="Failed to store certificate record")

    # Generate PDF
    pdf_bytes = generate_certificate_pdf(cert_data, hmac_hash)

    # Build filename
    safe_name = dataset_name.replace(" ", "_").replace("/", "_")[:50]
    date_str = str(cert_data.get("validation_date", ""))[:10]
    filename = f"TruQC-Certificate-{safe_name}-{date_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/certificates/{cert_id}/revoke")
def revoke_certificate(cert_id: str, body: RevokeRequest):
    """Revoke an active certificate.

    Sets status to 'revoked' with timestamp, user, and optional reason.
    Only matches certificates with status='active', so already-revoked
    certificates return 404.
    """
    supabase = get_supabase_client()

    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "status": "revoked",
        "revoked_at": now,
        "revoked_by": body.user_id,
        "revocation_reason": body.reason,
    }

    try:
        result = (
            supabase.table("certificates")
            .update(update_data)
            .eq("id", cert_id)
            .eq("status", "active")
            .execute()
        )
    except Exception as e:
        logger.error("Failed to revoke certificate %s: %s", cert_id, str(e))
        raise HTTPException(status_code=500, detail="Failed to revoke certificate")

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Certificate not found or already revoked",
        )

    return {"status": "revoked", "revoked_at": now}


@router.get("/certificates/{cert_id}/verify")
def verify_certificate(cert_id: str):
    """Public certificate verification endpoint (no auth required).

    Returns certificate status and details for active certificates,
    limited information for revoked certificates, or a not_found status
    for unknown IDs.  Returns 200 for all cases to prevent enumeration.
    """
    supabase = get_supabase_client()

    select_fields = (
        "id, dataset_name, validation_date, rules_applied, total_issues, "
        "pass_rate, hmac_hash, org_name, status, revoked_at, revocation_reason"
    )

    try:
        result = (
            supabase.table("certificates")
            .select(select_fields)
            .eq("id", cert_id)
            .single()
            .execute()
        )
    except Exception:
        # Not found (PostgREST raises for .single() with 0 rows)
        return JSONResponse(
            content={"status": "not_found"},
            headers={"Cache-Control": "no-store"},
        )

    if not result.data:
        return JSONResponse(
            content={"status": "not_found"},
            headers={"Cache-Control": "no-store"},
        )

    cert = result.data

    if cert.get("status") == "revoked":
        # Revoked: return only ID, status, revocation info (no dataset details)
        return JSONResponse(
            content={
                "id": cert["id"],
                "status": "revoked",
                "revoked_at": cert.get("revoked_at"),
                "revocation_reason": cert.get("revocation_reason"),
            },
            headers={"Cache-Control": "no-store"},
        )

    # Active: return full public-safe details
    return JSONResponse(
        content={
            "id": cert["id"],
            "status": "active",
            "dataset_name": cert.get("dataset_name"),
            "validation_date": cert.get("validation_date"),
            "rules_applied": cert.get("rules_applied"),
            "total_issues": cert.get("total_issues"),
            "pass_rate": cert.get("pass_rate"),
            "hmac_hash": cert.get("hmac_hash"),
            "org_name": cert.get("org_name"),
        },
        headers={"Cache-Control": "no-store"},
    )
