import io
import uuid

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.dependencies import get_supabase_client
from app.models.schemas import ValidateRequest, ValidateResponse
from app.services.validation import run_validation_pipeline
from app.validators.base import Severity

router = APIRouter(prefix="/api/v1", tags=["validation"])


@router.post("/validate", response_model=ValidateResponse)
def validate_dataset(request: ValidateRequest):
    """Run validation checks on a dataset.

    Uses sync `def` (not async def) since supabase-py is synchronous.
    FastAPI handles sync endpoints by running them in a thread pool.
    """
    supabase = get_supabase_client()

    # Fetch dataset record
    result = supabase.table("datasets").select("*").eq("id", request.dataset_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = result.data

    # Update status to validating
    supabase.table("datasets").update({"status": "validating"}).eq("id", request.dataset_id).execute()

    try:
        # Download file from storage
        file_bytes = supabase.storage.from_("datasets").download(dataset["storage_path"])

        # Parse into DataFrame
        if dataset["file_name"].endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(file_bytes),
                header=dataset.get("header_row_index", 0),
                dtype=str,
            )
        else:
            df = pd.read_excel(
                io.BytesIO(file_bytes),
                header=dataset.get("header_row_index", 0),
                dtype=str,
            )

        # Apply column mappings -- rename columns to mapped types
        mappings = dataset.get("column_mappings", []) or []
        rename_map = {}
        for m in mappings:
            if m.get("mappedType") and not m.get("ignored"):
                rename_map[m["originalName"]] = m["mappedType"]
        df = df.rename(columns=rename_map)

        # Convert numeric columns
        numeric_types = [
            "kp", "easting", "northing", "depth", "dob", "doc",
            "top", "elevation", "latitude", "longitude",
        ]
        for col in df.columns:
            if col in numeric_types:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Run validation pipeline with default config
        config = {
            "dob_min": 0, "dob_max": 10,
            "doc_min": 0, "doc_max": 10,
            "depth_min": 0, "depth_max": 500,
            "kp_gap_max": 0.1,
            "duplicate_kp_tolerance": 0.001,
            "zscore_threshold": 3.0,
            "iqr_multiplier": 1.5,
        }
        issues = run_validation_pipeline(df, mappings, config)

        # Count by severity
        critical_count = sum(1 for i in issues if i.severity == Severity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == Severity.WARNING)
        info_count = sum(1 for i in issues if i.severity == Severity.INFO)
        total_issues = len(issues)

        # Calculate pass rate (rows without critical issues / total rows)
        total_rows = len(df)
        rows_with_critical = len(set(i.row_number for i in issues if i.severity == Severity.CRITICAL))
        pass_rate = ((total_rows - rows_with_critical) / total_rows * 100) if total_rows > 0 else 100.0

        # Create validation run record
        run_id = str(uuid.uuid4())
        supabase.table("validation_runs").insert({
            "id": run_id,
            "dataset_id": request.dataset_id,
            "total_issues": total_issues,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "info_count": info_count,
            "pass_rate": pass_rate,
            "status": "completed",
        }).execute()

        # Batch insert validation issues
        if issues:
            issue_records = [
                {
                    "run_id": run_id,
                    "dataset_id": request.dataset_id,
                    "row_number": issue.row_number,
                    "column_name": issue.column_name,
                    "rule_type": issue.rule_type,
                    "severity": issue.severity.value,
                    "message": issue.message,
                    "expected": issue.expected,
                    "actual": issue.actual,
                    "kp_value": issue.kp_value,
                }
                for issue in issues
            ]
            supabase.table("validation_issues").insert(issue_records).execute()

        # Update dataset status
        supabase.table("datasets").update({"status": "validated"}).eq("id", request.dataset_id).execute()

        return ValidateResponse(
            run_id=run_id,
            total_issues=total_issues,
            critical_count=critical_count,
            warning_count=warning_count,
            info_count=info_count,
            pass_rate=pass_rate,
            status="completed",
        )

    except Exception as e:
        # Update status to error on failure
        supabase.table("datasets").update(
            {"status": "validation_error"}
        ).eq("id", request.dataset_id).execute()
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
