"""Direct file validation endpoint — validates uploaded CSV/Excel without requiring a dataset record.

Used by the pipeline to get consistent validation results with the backend
validators, without needing to create a temporary dataset in Supabase.
"""

import io
import logging

import pandas as pd
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.models.schemas import ProfileConfig
from app.services.templates import resolve_config
from app.services.validation import run_validation_pipeline
from app.validators.base import Severity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["validation"])


@router.post("/validate-file")
async def validate_file(file: UploadFile = File(...)):
    """Validate an uploaded file directly without a dataset record.

    Returns validation issues in the same format as the dataset validation endpoint.
    """
    try:
        file_bytes = await file.read()
        file_name = file.filename or "upload.csv"

        # Parse into DataFrame
        if file_name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
        elif file_name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
        else:
            return JSONResponse(
                content={"error": f"Unsupported file type: {file_name}"},
                status_code=400,
            )

        if df.empty:
            return JSONResponse(
                content={"issues": [], "summary": {"total": 0, "critical": 0, "warning": 0, "info": 0}},
            )

        # Build column mappings from headers (auto-detect)
        column_mappings = []
        known_types = {
            "kp": "kp", "easting": "easting", "east": "easting",
            "northing": "northing", "north": "northing",
            "latitude": "latitude", "lat": "latitude",
            "longitude": "longitude", "lon": "longitude", "lng": "longitude",
            "depth": "depth", "dob": "dob", "doc": "doc", "top": "top",
            "elevation": "elevation", "pipe_diameter": "pipe_diameter",
            "wall_thickness": "wall_thickness", "coating_type": "coating_type",
        }
        for col in df.columns:
            mapped_type = known_types.get(col.lower().strip())
            column_mappings.append({
                "originalName": col,
                "mappedType": mapped_type,
                "ignored": False,
            })

        # Convert numeric columns
        numeric_types = {
            "kp", "easting", "northing", "depth", "dob", "doc",
            "top", "elevation", "latitude", "longitude",
        }
        for col in df.columns:
            if col.lower().strip() in numeric_types:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Run validation with default config
        profile_config = ProfileConfig()
        flat_config, enabled_checks = resolve_config(profile_config)
        issues = run_validation_pipeline(df, column_mappings, flat_config, enabled_checks=enabled_checks)

        # Format response
        issue_list = []
        for issue in issues:
            issue_list.append({
                "row_number": issue.row_number,
                "column_name": issue.column_name,
                "rule_type": issue.rule_type,
                "severity": issue.severity.value,
                "message": issue.message,
                "expected": issue.expected,
                "actual": issue.actual,
                "kp_value": issue.kp_value,
            })

        critical_count = sum(1 for i in issues if i.severity == Severity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == Severity.WARNING)
        info_count = sum(1 for i in issues if i.severity == Severity.INFO)

        total_rows = len(df)
        rows_with_critical = len(set(i.row_number for i in issues if i.severity == Severity.CRITICAL))
        pass_rate = ((total_rows - rows_with_critical) / total_rows * 100) if total_rows > 0 else 100.0

        return JSONResponse(content={
            "issues": issue_list,
            "summary": {
                "total": len(issues),
                "critical": critical_count,
                "warning": warning_count,
                "info": info_count,
            },
            "pass_rate": pass_rate,
            "total_rows": total_rows,
        })

    except Exception as e:
        logger.error("Direct file validation failed: %s", str(e))
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
        )
