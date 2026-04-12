"""Versions endpoint -- list versions and compute diffs between dataset versions."""

import io
import logging
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.dependencies import get_supabase_client
from app.services.versioning import compute_version_diff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/datasets", tags=["versions"])


class DiffRequest(BaseModel):
    """Request body for version diff computation."""
    version_a: int
    version_b: int
    page: int = 1
    page_size: int = 50


@router.get("/{dataset_id}/versions")
def list_versions(dataset_id: str):
    """List all versions for a dataset, newest first."""
    supabase = get_supabase_client()
    result = (
        supabase.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=True)
        .execute()
    )
    return {"versions": result.data or []}


@router.post("/{dataset_id}/diff")
def compute_diff(dataset_id: str, body: DiffRequest):
    """Compare two versions of a dataset.

    Downloads both version files from storage, parses with pandas,
    computes row-level diff, and returns paginated results.

    Timeout: 60 seconds (handled by upstream proxy).
    """
    supabase = get_supabase_client()

    # Look up both version records
    version_a = (
        supabase.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_number", body.version_a)
        .execute()
    )
    version_b = (
        supabase.table("dataset_versions")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("version_number", body.version_b)
        .execute()
    )

    if not version_a.data:
        raise HTTPException(status_code=404, detail=f"Version {body.version_a} not found")
    if not version_b.data:
        raise HTTPException(status_code=404, detail=f"Version {body.version_b} not found")

    va = version_a.data[0]
    vb = version_b.data[0]

    # Download both files from storage
    try:
        file_a = supabase.storage.from_("datasets").download(va["storage_path"])
        file_b = supabase.storage.from_("datasets").download(vb["storage_path"])
    except Exception as e:
        logger.error("Failed to download version files for diff: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to download version files")

    # Parse with pandas
    try:
        if va["storage_path"].endswith(".csv"):
            df_a = pd.read_csv(io.BytesIO(file_a), dtype=str)
        else:
            df_a = pd.read_excel(io.BytesIO(file_a), dtype=str)

        if vb["storage_path"].endswith(".csv"):
            df_b = pd.read_csv(io.BytesIO(file_b), dtype=str)
        else:
            df_b = pd.read_excel(io.BytesIO(file_b), dtype=str)
    except Exception as e:
        logger.error("Failed to parse version files for diff: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to parse version files")

    # Compute diff
    try:
        diff = compute_version_diff(df_a, df_b)
    except Exception as e:
        logger.error("Diff computation error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to compute diff")

    # Paginate row-level detail arrays
    page = body.page
    page_size = body.page_size
    start = (page - 1) * page_size
    end = start + page_size

    paginated_added = diff["added"][start:end]
    paginated_removed = diff["removed"][start:end]
    paginated_modified = diff["modified"][start:end]

    total_added = len(diff["added"])
    total_removed = len(diff["removed"])
    total_modified = len(diff["modified"])

    return JSONResponse(content={
        "summary": diff["summary"],
        "added": paginated_added,
        "removed": paginated_removed,
        "modified": paginated_modified,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_added": total_added,
            "total_removed": total_removed,
            "total_modified": total_modified,
            "has_more": (
                end < total_added
                or end < total_removed
                or end < total_modified
            ),
        },
    })
