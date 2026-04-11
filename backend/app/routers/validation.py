import io
import logging
import uuid

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.config import settings
from app.dependencies import get_supabase_client
from app.models.schemas import ProfileConfig, ValidateRequest
from app.services.templates import resolve_config
from app.services.validation import run_validation_pipeline
from app.services.webhooks import dispatch_webhooks
from app.validators.base import Severity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["validation"])


def _legacy_validation_background(dataset_id: str, config: ProfileConfig | None) -> None:
    """Legacy: Run full validation pipeline via BackgroundTasks.

    Used when USE_JOB_QUEUE=false (default during transition).
    Always updates dataset status on completion or failure -- never leaves
    a dataset stuck in 'validating' state.
    """
    supabase = get_supabase_client()

    try:
        # Fetch dataset record
        result = supabase.table("datasets").select("*").eq("id", dataset_id).single().execute()
        if not result.data:
            logger.error("Background validation: dataset %s not found", dataset_id)
            supabase.table("datasets").update(
                {"status": "validation_error"}
            ).eq("id", dataset_id).execute()
            return

        dataset = result.data

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

        # Deduplicate column names (append _2, _3, etc. for duplicates)
        seen: dict[str, int] = {}
        new_cols = []
        for col in df.columns:
            if col in seen:
                seen[col] += 1
                new_cols.append(f"{col}_{seen[col]}")
            else:
                seen[col] = 1
                new_cols.append(col)
        df.columns = new_cols

        # Convert numeric columns to float (DataFrame loaded as dtype=str)
        numeric_types = {
            "kp", "easting", "northing", "depth", "dob", "doc",
            "top", "elevation", "latitude", "longitude",
        }
        for col in df.columns:
            if col in numeric_types:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Resolve validation config from request (or use General Survey defaults)
        profile_config = config or ProfileConfig()
        flat_config, enabled_checks = resolve_config(profile_config)
        issues = run_validation_pipeline(df, mappings, flat_config, enabled_checks=enabled_checks)

        # Count by severity
        critical_count = sum(1 for i in issues if i.severity == Severity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == Severity.WARNING)
        info_count = sum(1 for i in issues if i.severity == Severity.INFO)
        total_issues = len(issues)

        # Calculate pass rate (rows without critical issues / total rows)
        total_rows = len(df)
        rows_with_critical = len(set(i.row_number for i in issues if i.severity == Severity.CRITICAL))
        pass_rate = ((total_rows - rows_with_critical) / total_rows * 100) if total_rows > 0 else 100.0

        # Create validation run record with config snapshot
        run_id = str(uuid.uuid4())
        supabase.table("validation_runs").insert({
            "id": run_id,
            "dataset_id": dataset_id,
            "total_issues": total_issues,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "info_count": info_count,
            "pass_rate": pass_rate,
            "status": "completed",
            "config_snapshot": profile_config.model_dump(),
        }).execute()

        # Batch insert validation issues
        if issues:
            issue_records = [
                {
                    "run_id": run_id,
                    "dataset_id": dataset_id,
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

        # Update dataset status to validated
        supabase.table("datasets").update({"status": "validated"}).eq("id", dataset_id).execute()
        logger.info("Background validation completed for dataset %s", dataset_id)

        # Dispatch webhooks on successful validation
        try:
            dispatch_webhooks(dataset_id, "validation.completed", {
                "dataset_id": dataset_id,
                "run_id": run_id,
                "total_issues": total_issues,
                "critical_count": critical_count,
                "pass_rate": pass_rate,
            })
        except Exception as wh_err:
            logger.error("Webhook dispatch failed for dataset %s: %s", dataset_id, str(wh_err))

    except Exception as e:
        # Always update status on failure -- never leave dataset stuck in 'validating'
        import traceback
        traceback.print_exc()
        logger.error("Background validation failed for dataset %s: %s", dataset_id, str(e))
        try:
            supabase.table("datasets").update(
                {"status": "validation_error"}
            ).eq("id", dataset_id).execute()
        except Exception as update_err:
            logger.error("Failed to update error status for dataset %s: %s", dataset_id, str(update_err))

        # Dispatch webhooks on validation failure
        try:
            dispatch_webhooks(dataset_id, "validation.failed", {
                "dataset_id": dataset_id,
                "error": str(e),
            })
        except Exception as wh_err:
            logger.error("Webhook dispatch (failure) failed for dataset %s: %s", dataset_id, str(wh_err))


@router.post("/validate", status_code=202)
async def validate_dataset(request: ValidateRequest, background_tasks: BackgroundTasks):
    """Accept validation request and process in background.

    When USE_JOB_QUEUE=true: enqueues via procrastinate for persistent,
    retry-capable processing. Returns job_id for tracking.

    When USE_JOB_QUEUE=false (default): uses legacy BackgroundTasks path.
    """
    supabase = get_supabase_client()

    # Quick check: verify dataset exists
    result = supabase.table("datasets").select("id").eq("id", request.dataset_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if settings.use_job_queue:
        # Queue-based path: persistent job with retry
        from app.queue.tasks import validate_dataset as validate_task
        from app.queue.tasks import record_job_run

        # Insert a job_runs record with status "queued"
        job_run_id = record_job_run(
            supabase, request.dataset_id,
            job_id=None,
            status="queued",
            config_snapshot=request.config.model_dump() if request.config else None,
        )

        # Defer the job to procrastinate
        config_json = request.config.model_dump() if request.config else None
        job_id = await validate_task.defer_async(
            dataset_id=request.dataset_id,
            config_json=config_json,
        )

        # Update job_runs record with the procrastinate job_id
        supabase.table("job_runs").update(
            {"procrastinate_job_id": job_id}
        ).eq("id", job_run_id).execute()

        logger.info(
            "Validation job enqueued for dataset %s (job_id=%s, run_id=%s)",
            request.dataset_id, job_id, job_run_id,
        )

        return {
            "status": "accepted",
            "dataset_id": request.dataset_id,
            "job_id": job_id,
            "job_run_id": job_run_id,
        }
    else:
        # Legacy path: fire-and-forget BackgroundTasks
        background_tasks.add_task(
            _legacy_validation_background, request.dataset_id, request.config
        )
        return {"status": "accepted", "dataset_id": request.dataset_id}
