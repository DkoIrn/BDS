import io
import logging
import uuid

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.config import settings
from app.dependencies import get_supabase_client
from app.models.schemas import CrossDatasetConfig, ProfileConfig, ValidateRequest
from app.services.templates import resolve_config
from app.services.validation import run_validation_pipeline
from app.services.webhooks import dispatch_webhooks
from app.validators.base import Severity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["validation"])


def _legacy_validation_background(
    dataset_id: str,
    config: ProfileConfig | None,
    secondary_dataset_id: str | None = None,
    cross_dataset_config: CrossDatasetConfig | None = None,
    custom_rule_ids: list[str] | None = None,
) -> None:
    """Legacy: Run full validation pipeline via BackgroundTasks.

    Used when USE_JOB_QUEUE=false (default during transition).
    Always updates dataset status on completion or failure -- never leaves
    a dataset stuck in 'validating' state.

    When secondary_dataset_id is provided, also runs cross-dataset validation
    between the two datasets and merges issues into the same run.
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

        # --- Cross-dataset validation (when secondary_dataset_id is provided) ---
        cross_config_snapshot = None
        if secondary_dataset_id:
            try:
                from app.validators.cross_dataset import run_cross_dataset_checks
                from app.services.cross_validation_presets import (
                    PRESETS, auto_match_columns, get_preset_for_types,
                )

                # Fetch secondary dataset
                sec_result = supabase.table("datasets").select("*").eq("id", secondary_dataset_id).single().execute()
                if sec_result.data:
                    sec_dataset = sec_result.data
                    sec_bytes = supabase.storage.from_("datasets").download(sec_dataset["storage_path"])

                    if sec_dataset["file_name"].endswith(".csv"):
                        df_b = pd.read_csv(
                            io.BytesIO(sec_bytes),
                            header=sec_dataset.get("header_row_index", 0),
                            dtype=str,
                        )
                    else:
                        df_b = pd.read_excel(
                            io.BytesIO(sec_bytes),
                            header=sec_dataset.get("header_row_index", 0),
                            dtype=str,
                        )

                    # Apply column mappings for secondary dataset
                    sec_mappings = sec_dataset.get("column_mappings", []) or []
                    sec_rename = {}
                    for m in sec_mappings:
                        if m.get("mappedType") and not m.get("ignored"):
                            sec_rename[m["originalName"]] = m["mappedType"]
                    df_b = df_b.rename(columns=sec_rename)

                    # Convert numeric columns
                    for col in df_b.columns:
                        if col in numeric_types:
                            df_b[col] = pd.to_numeric(df_b[col], errors="coerce")

                    # Determine preset and column mapping
                    xd_config = cross_dataset_config or CrossDatasetConfig()
                    col_mapping = xd_config.column_mapping or []

                    # Auto-detect column mapping if not provided
                    if not col_mapping:
                        col_mapping = auto_match_columns(
                            list(df.columns), list(df_b.columns)
                        )

                    # Select preset
                    preset = None
                    if xd_config.preset_id and xd_config.preset_id in PRESETS:
                        preset = PRESETS[xd_config.preset_id]
                    elif xd_config.dataset_type_a and xd_config.dataset_type_b:
                        preset = get_preset_for_types(
                            xd_config.dataset_type_a, xd_config.dataset_type_b
                        )

                    if preset:
                        # Build tolerance config from user overrides
                        tol_config = dict(xd_config.tolerances or {})

                        cross_issues = run_cross_dataset_checks(
                            df, df_b, preset, col_mapping, tol_config
                        )
                        issues.extend(cross_issues)

                        cross_config_snapshot = {
                            "preset_id": preset.id,
                            "preset_name": preset.name,
                            "dataset_type_a": preset.dataset_a_type,
                            "dataset_type_b": preset.dataset_b_type,
                            "column_mapping": col_mapping,
                            "tolerances": tol_config,
                        }
                    else:
                        logger.warning(
                            "No cross-validation preset found for types %s/%s",
                            xd_config.dataset_type_a, xd_config.dataset_type_b,
                        )
                else:
                    logger.warning("Secondary dataset %s not found", secondary_dataset_id)
            except Exception as xd_err:
                logger.error(
                    "Cross-dataset validation failed for %s vs %s: %s",
                    dataset_id, secondary_dataset_id, str(xd_err),
                )
        # --- End cross-dataset validation ---

        # --- Custom rules execution ---
        if custom_rule_ids:
            try:
                from app.models.schemas import ConditionGroup as CG, CustomRuleDefinition as CRD
                from app.services.custom_rules import execute_custom_rule as exec_cr

                cr_result = (
                    supabase.table("custom_rules")
                    .select("*")
                    .in_("id", custom_rule_ids)
                    .eq("enabled", True)
                    .execute()
                )
                custom_rules = cr_result.data or []

                kp_col = None
                for m in mappings:
                    if m.get("mappedType") == "kp" and not m.get("ignored"):
                        kp_col = "kp"
                        break

                for cr in custom_rules:
                    try:
                        group = CG(**cr["rule_definition"])
                        rule_def = CRD(
                            name=cr["name"],
                            description=cr.get("description", ""),
                            severity=cr.get("severity", "warning"),
                            root_group=group,
                        )
                        cr_issues = exec_cr(df, rule_def, kp_column=kp_col)
                        issues.extend(cr_issues)
                    except Exception as cr_err:
                        logger.warning(
                            "Custom rule %s execution failed: %s",
                            cr.get("id", "?"), str(cr_err),
                        )
            except Exception as cr_err:
                logger.error(
                    "Custom rules execution failed for dataset %s: %s",
                    dataset_id, str(cr_err),
                )
        # --- End custom rules execution ---

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
        run_record = {
            "id": run_id,
            "dataset_id": dataset_id,
            "total_issues": total_issues,
            "critical_count": critical_count,
            "warning_count": warning_count,
            "info_count": info_count,
            "pass_rate": pass_rate,
            "status": "completed",
            "config_snapshot": profile_config.model_dump(),
        }
        if secondary_dataset_id:
            run_record["secondary_dataset_id"] = secondary_dataset_id
        if cross_config_snapshot:
            run_record["cross_validation_config"] = cross_config_snapshot
        supabase.table("validation_runs").insert(run_record).execute()

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

        # Create version snapshot for this validation run
        try:
            from app.services.versioning import create_version_snapshot

            create_version_snapshot(
                supabase=supabase,
                dataset_id=dataset_id,
                user_id=dataset.get("uploaded_by", ""),
                validation_run_id=run_id,
                issue_count=total_issues,
                critical_count=critical_count,
                warning_count=warning_count,
                info_count=info_count,
                row_count=total_rows,
                column_count=len(df.columns),
                file_size=dataset.get("file_size", 0),
                storage_path=dataset.get("storage_path", ""),
            )
        except Exception as ver_err:
            logger.error("Version snapshot failed for dataset %s: %s", dataset_id, str(ver_err))

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

        # Create in-app notification for triggering user
        try:
            job_id = dataset.get("job_id")
            org_id = None
            if job_id:
                job = supabase.table("jobs").select("project_id").eq("id", job_id).single().execute()
                if job.data:
                    project = supabase.table("projects").select("org_id").eq("id", job.data["project_id"]).single().execute()
                    org_id = project.data["org_id"] if project.data else None
            if org_id:
                supabase.table("notifications").insert({
                    "user_id": dataset["user_id"],
                    "org_id": org_id,
                    "type": "validation_complete",
                    "title": "Validation complete",
                    "body": f"{dataset['file_name']} — {total_issues} issues found",
                    "resource_type": "dataset",
                    "resource_id": dataset_id,
                    "link_url": f"/pipeline?dataset={dataset_id}",
                }).execute()
        except Exception as notif_err:
            logger.warning("Notification creation failed for dataset %s: %s", dataset_id, str(notif_err))

        # Log activity event for project feed
        try:
            if job_id and org_id:
                job_data = supabase.table("jobs").select("project_id").eq("id", job_id).single().execute()
                project_id = job_data.data["project_id"] if job_data.data else None
                if project_id:
                    file_name = dataset.get("file_name", "dataset")
                    summary = (
                        f"Validation passed for {file_name}"
                        if total_issues == 0
                        else f"Validation found {total_issues} issue{'s' if total_issues != 1 else ''} in {file_name}"
                    )
                    supabase.table("activity_events").insert({
                        "project_id": project_id,
                        "org_id": org_id,
                        "actor_id": dataset.get("uploaded_by") or dataset.get("user_id", ""),
                        "event_type": "validation_run",
                        "summary": summary,
                        "resource_type": "dataset",
                        "resource_id": dataset_id,
                        "metadata": {
                            "total_issues": total_issues,
                            "critical_count": critical_count,
                            "pass_rate": pass_rate,
                        },
                    }).execute()
        except Exception as act_err:
            logger.warning("Activity logging failed for dataset %s: %s", dataset_id, str(act_err))

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
            _legacy_validation_background,
            request.dataset_id,
            request.config,
            request.secondary_dataset_id,
            request.cross_dataset_config,
            request.custom_rule_ids,
        )
        return {"status": "accepted", "dataset_id": request.dataset_id}
