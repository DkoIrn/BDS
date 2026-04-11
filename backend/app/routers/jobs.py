"""Job status and history API endpoints.

Provides list, detail, retry, and cancel operations for job_runs.
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.dependencies import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("")
def list_jobs(
    dataset_id: Optional[str] = Query(None, description="Filter by dataset ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
):
    """List recent job_runs, optionally filtered by dataset_id or status."""
    supabase = get_supabase_client()

    query = supabase.table("job_runs").select("*")

    if dataset_id:
        query = query.eq("dataset_id", dataset_id)
    if status:
        query = query.eq("status", status)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return {"jobs": result.data, "count": len(result.data)}


@router.get("/{job_id}")
def get_job(job_id: str):
    """Get a single job_run detail by ID."""
    supabase = get_supabase_client()

    result = supabase.table("job_runs").select("*").eq("id", job_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return result.data


@router.post("/{job_id}/retry")
async def retry_job(job_id: str):
    """Manual retry: enqueue a new validation job for the same dataset.

    Marks the old job as superseded and creates a new queued job.
    """
    supabase = get_supabase_client()

    # Fetch the original job
    result = supabase.table("job_runs").select("*").eq("id", job_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    original_job = result.data
    dataset_id = original_job["dataset_id"]

    if not settings.use_job_queue:
        raise HTTPException(
            status_code=400,
            detail="Job queue is not enabled. Set USE_JOB_QUEUE=true to use retry.",
        )

    from app.queue.tasks import validate_dataset as validate_task
    from app.queue.tasks import record_job_run

    # Create new job_runs record
    config_snapshot = original_job.get("config_snapshot")
    job_run_id = record_job_run(
        supabase, dataset_id,
        job_id=None,
        status="queued",
        config_snapshot=config_snapshot,
    )

    # Defer the new job
    job_id_new = await validate_task.defer_async(
        dataset_id=dataset_id,
        config_json=config_snapshot,
    )

    # Update new job_runs record with procrastinate job_id
    supabase.table("job_runs").update(
        {"procrastinate_job_id": job_id_new}
    ).eq("id", job_run_id).execute()

    logger.info(
        "Retry: new validation job enqueued for dataset %s (job_id=%s)",
        dataset_id, job_id_new,
    )

    return {
        "status": "retried",
        "original_job_id": job_id,
        "new_job_id": job_id_new,
        "new_job_run_id": job_run_id,
        "dataset_id": dataset_id,
    }


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job.

    Uses procrastinate's job_manager to cancel the job by its procrastinate ID.
    """
    supabase = get_supabase_client()

    # Fetch the job
    result = supabase.table("job_runs").select("*").eq("id", job_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data

    if job["status"] not in ("queued", "running"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status '{job['status']}'",
        )

    if not settings.use_job_queue:
        raise HTTPException(
            status_code=400,
            detail="Job queue is not enabled. Set USE_JOB_QUEUE=true to cancel jobs.",
        )

    procrastinate_job_id = job.get("procrastinate_job_id")
    if procrastinate_job_id:
        from app.queue import app as procrastinate_app

        try:
            await procrastinate_app.job_manager.cancel_job_by_id(
                procrastinate_job_id, abort=True
            )
        except Exception as e:
            logger.error("Failed to cancel procrastinate job %s: %s", procrastinate_job_id, e)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to cancel job: {str(e)}",
            )

    # Update job_runs status to cancelled
    supabase.table("job_runs").update(
        {"status": "cancelled"}
    ).eq("id", job_id).execute()

    logger.info("Job %s cancelled (procrastinate_id=%s)", job_id, procrastinate_job_id)

    return {
        "status": "cancelled",
        "job_id": job_id,
        "dataset_id": job["dataset_id"],
    }
