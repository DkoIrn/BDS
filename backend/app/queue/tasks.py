"""Procrastinate task definitions for async job processing.

The validate_dataset task wraps the existing validation pipeline with:
- Retry strategy (3 attempts, exponential backoff)
- Idempotent cleanup before each attempt
- Progress reporting to datasets.validation_progress
- Job tracking via job_runs table

Note: Heavy dependencies (pandas, validators) are imported lazily inside the
task body to keep module import fast and testable.
"""

import logging
import traceback
import uuid

import procrastinate

from app.queue import app
from app.dependencies import get_supabase_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def cleanup_previous_run(supabase, dataset_id: str) -> None:
    """Delete existing validation results to ensure idempotency on retry.

    Deletes issues first (FK constraint), then the run record.
    """
    supabase.table("validation_issues").delete().eq("dataset_id", dataset_id).execute()
    supabase.table("validation_runs").delete().eq("dataset_id", dataset_id).execute()


def update_progress(supabase, dataset_id: str, stage: str, detail: str = "") -> None:
    """Write progress to datasets.validation_progress column.

    Frontend subscribes to this via Supabase Realtime for live updates.
    """
    supabase.table("datasets").update({
        "validation_progress": {"stage": stage, "detail": detail}
    }).eq("id", dataset_id).execute()


def record_job_run(
    supabase,
    dataset_id: str,
    job_id: int | None,
    status: str,
    attempt_number: int = 1,
    error_summary: str | None = None,
    error_detail: str | None = None,
    config_snapshot: dict | None = None,
    result_summary: dict | None = None,
    duration_ms: int | None = None,
) -> str:
    """Insert a job_runs record for tracking."""
    run_id = str(uuid.uuid4())
    record = {
        "id": run_id,
        "dataset_id": dataset_id,
        "job_type": "validation",
        "procrastinate_job_id": job_id,
        "status": status,
        "attempt_number": attempt_number,
        "max_attempts": 3,
    }
    if error_summary:
        record["error_summary"] = error_summary
    if error_detail:
        record["error_detail"] = error_detail
    if config_snapshot:
        record["config_snapshot"] = config_snapshot
    if result_summary:
        record["result_summary"] = result_summary
    if duration_ms is not None:
        record["duration_ms"] = duration_ms

    supabase.table("job_runs").insert(record).execute()
    return run_id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_org_id_for_dataset(supabase, dataset: dict) -> str | None:
    """Resolve org_id from dataset via job → project chain."""
    try:
        job_id = dataset.get("job_id")
        if not job_id:
            return None
        job = supabase.table("jobs").select("project_id").eq("id", job_id).single().execute()
        if not job.data:
            return None
        project = supabase.table("projects").select("org_id").eq("id", job.data["project_id"]).single().execute()
        return project.data["org_id"] if project.data else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Task definition
# ---------------------------------------------------------------------------

# Retry strategy: 3 attempts with exponential backoff (~10s, ~100s, ~1000s)
_retry = procrastinate.RetryStrategy(max_attempts=3, exponential_wait=10)


@app.task(
    name="validate_dataset",
    queue="validation",
    retry=_retry,
)
async def validate_dataset(
    dataset_id: str,
    config_json: dict | None = None,
) -> None:
    """Persistent, retryable validation job.

    Wraps the existing validation pipeline with queue-level retry,
    idempotent cleanup, and progress reporting.
    """
    # Lazy imports for heavy dependencies (pandas, validators)
    import io
    import time

    import pandas as pd

    from app.models.schemas import ProfileConfig
    from app.services.templates import resolve_config
    from app.services.validation import run_validation_pipeline
    from app.services.webhooks import dispatch_webhooks
    from app.validators.base import Severity

    start_time = time.time()
    supabase = get_supabase_client()

    try:
        # 1. Update progress: starting
        update_progress(supabase, dataset_id, "starting", "Preparing validation")

        # 2. Cleanup previous results (idempotency -- JOBQ-05)
        cleanup_previous_run(supabase, dataset_id)

        # 3. Fetch dataset record
        update_progress(supabase, dataset_id, "downloading", "Fetching dataset")
        result = supabase.table("datasets").select("*").eq("id", dataset_id).single().execute()
        if not result.data:
            logger.error("Queue validation: dataset %s not found", dataset_id)
            supabase.table("datasets").update(
                {"status": "validation_error"}
            ).eq("id", dataset_id).execute()
            return

        dataset = result.data

        # 4. Download file from storage
        file_bytes = supabase.storage.from_("datasets").download(dataset["storage_path"])

        # 5. Parse into DataFrame
        update_progress(supabase, dataset_id, "parsing", "Reading file data")
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

        # Apply column mappings
        mappings = dataset.get("column_mappings", []) or []
        rename_map = {}
        for m in mappings:
            if m.get("mappedType") and not m.get("ignored"):
                rename_map[m["originalName"]] = m["mappedType"]
        df = df.rename(columns=rename_map)

        # Deduplicate column names
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

        # Convert numeric columns to float
        numeric_types = {
            "kp", "easting", "northing", "depth", "dob", "doc",
            "top", "elevation", "latitude", "longitude",
        }
        for col in df.columns:
            if col in numeric_types:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # 6. Run validation pipeline
        profile_config = ProfileConfig(**config_json) if config_json else ProfileConfig()
        flat_config, enabled_checks = resolve_config(profile_config)

        update_progress(supabase, dataset_id, "validating", "Running quality checks")
        issues = run_validation_pipeline(df, mappings, flat_config, enabled_checks=enabled_checks)

        # 7. Store results
        update_progress(supabase, dataset_id, "storing_results", "Saving validation results")

        critical_count = sum(1 for i in issues if i.severity == Severity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == Severity.WARNING)
        info_count = sum(1 for i in issues if i.severity == Severity.INFO)
        total_issues = len(issues)

        total_rows = len(df)
        rows_with_critical = len(set(i.row_number for i in issues if i.severity == Severity.CRITICAL))
        pass_rate = ((total_rows - rows_with_critical) / total_rows * 100) if total_rows > 0 else 100.0

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

        # 8. Update dataset status
        elapsed_ms = int((time.time() - start_time) * 1000)
        supabase.table("datasets").update({
            "status": "validated",
            "validation_progress": {"stage": "complete", "detail": "Validation finished"},
        }).eq("id", dataset_id).execute()

        # 8.5. Create version snapshot (non-blocking -- failure does not break validation)
        try:
            from app.services.versioning import create_version_snapshot

            create_version_snapshot(
                supabase=supabase,
                dataset_id=dataset_id,
                user_id=dataset["user_id"],
                validation_run_id=run_id,
                issue_count=total_issues,
                critical_count=critical_count,
                warning_count=warning_count,
                info_count=info_count,
                row_count=len(df),
                column_count=len(df.columns),
                file_size=len(file_bytes),
                storage_path=dataset["storage_path"],
            )
        except Exception as snap_err:
            logger.warning(
                "Version snapshot failed for dataset %s: %s",
                dataset_id, str(snap_err),
            )

        # 9. Record successful job run
        record_job_run(
            supabase, dataset_id,
            job_id=None,
            status="succeeded",
            config_snapshot=profile_config.model_dump(),
            result_summary={
                "total_issues": total_issues,
                "critical_count": critical_count,
                "pass_rate": round(pass_rate, 2),
            },
            duration_ms=elapsed_ms,
        )

        logger.info("Queue validation completed for dataset %s", dataset_id)

        # 10. Dispatch webhooks
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

        # 11. Create in-app notification for triggering user
        try:
            org_id = _get_org_id_for_dataset(supabase, dataset)
            if org_id:
                supabase.table("notifications").insert({
                    "user_id": dataset["user_id"],
                    "org_id": org_id,
                    "type": "validation_complete",
                    "title": f"Validation complete",
                    "body": f"{dataset['file_name']} — {total_issues} issues found",
                    "resource_type": "dataset",
                    "resource_id": dataset_id,
                    "link_url": f"/pipeline?dataset={dataset_id}",
                }).execute()
        except Exception as notif_err:
            logger.warning("Notification creation failed for dataset %s: %s", dataset_id, str(notif_err))

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        tb = traceback.format_exc()
        logger.error("Queue validation failed for dataset %s: %s", dataset_id, str(e))

        # Update progress with error
        try:
            update_progress(supabase, dataset_id, "error", str(e)[:500])
        except Exception:
            pass

        # Record failed job run
        try:
            record_job_run(
                supabase, dataset_id,
                job_id=None,
                status="failed",
                error_summary=str(e)[:200],
                error_detail=tb[:2000],
                duration_ms=elapsed_ms,
            )
        except Exception:
            pass

        # Set dataset status to validation_error
        try:
            supabase.table("datasets").update(
                {"status": "validation_error"}
            ).eq("id", dataset_id).execute()
        except Exception as update_err:
            logger.error("Failed to update error status for %s: %s", dataset_id, str(update_err))

        # Dispatch failure webhooks
        try:
            from app.services.webhooks import dispatch_webhooks
            dispatch_webhooks(dataset_id, "validation.failed", {
                "dataset_id": dataset_id,
                "error": str(e),
            })
        except Exception as wh_err:
            logger.error("Webhook dispatch (failure) failed for %s: %s", dataset_id, str(wh_err))

        # Create failure notification for triggering user
        try:
            org_id = _get_org_id_for_dataset(supabase, dataset)
            if org_id:
                supabase.table("notifications").insert({
                    "user_id": dataset["user_id"],
                    "org_id": org_id,
                    "type": "validation_failed",
                    "title": f"Validation failed",
                    "body": f"{dataset['file_name']} — {str(e)[:100]}",
                    "resource_type": "dataset",
                    "resource_id": dataset_id,
                    "link_url": f"/pipeline?dataset={dataset_id}",
                }).execute()
        except Exception as notif_err:
            logger.warning("Failure notification failed for %s: %s", dataset_id, str(notif_err))

        # Re-raise for procrastinate retry
        raise
