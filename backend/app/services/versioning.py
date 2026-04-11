"""Dataset versioning service.

Handles snapshot creation after validation runs, auto-pruning at the version
limit, and diff computation between version DataFrames.
"""

import logging
from datetime import datetime, timezone

import pandas as pd

logger = logging.getLogger(__name__)

MAX_VERSIONS = 10


def create_version_snapshot(
    supabase,
    dataset_id: str,
    user_id: str,
    validation_run_id: str,
    issue_count: int,
    critical_count: int,
    warning_count: int,
    info_count: int,
    row_count: int,
    column_count: int,
    file_size: int,
    storage_path: str,
) -> None:
    """Create a versioned snapshot of the dataset file after validation.

    Implements prune-then-insert: if the dataset already has MAX_VERSIONS,
    the oldest version row is deleted before the new one is inserted.
    Storage file cleanup for pruned versions is attempted after DB operations
    with logged warnings on failure.

    Args:
        supabase: Supabase client instance.
        dataset_id: The dataset to version.
        user_id: Owner user ID (for storage path).
        validation_run_id: The validation run that triggered this snapshot.
        issue_count: Total issues found in validation.
        critical_count: Number of critical severity issues.
        warning_count: Number of warning severity issues.
        info_count: Number of info severity issues.
        row_count: Number of rows in the dataset.
        column_count: Number of columns in the dataset.
        file_size: Size of the raw file in bytes.
        storage_path: Current storage path of the dataset file.
    """
    # 1. Fetch existing versions ordered by version_number ASC
    existing = (
        supabase.table("dataset_versions")
        .select("id, version_number, storage_path")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=False)
        .execute()
    )
    versions = existing.data or []
    paths_to_delete = []

    # 2. Prune if at limit
    while len(versions) >= MAX_VERSIONS:
        oldest = versions.pop(0)
        supabase.table("dataset_versions").delete().eq("id", oldest["id"]).execute()
        paths_to_delete.append(oldest["storage_path"])

    # 3. Determine next version number (max + 1, never reuse)
    next_version = (max(v["version_number"] for v in versions) + 1) if versions else 1

    # 4. Copy file to versioned storage path
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    version_path = f"{user_id}/{dataset_id}/versions/v{next_version}_{timestamp}.csv"

    file_bytes = supabase.storage.from_("datasets").download(storage_path)
    supabase.storage.from_("datasets").upload(version_path, file_bytes)

    # 5. Insert version record
    supabase.table("dataset_versions").insert({
        "dataset_id": dataset_id,
        "version_number": next_version,
        "storage_path": version_path,
        "row_count": row_count,
        "column_count": column_count,
        "file_size": file_size,
        "validation_run_id": validation_run_id,
        "issue_count": issue_count,
        "severity_breakdown": {
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count,
        },
    }).execute()

    # 6. Async cleanup of pruned storage files (non-blocking)
    for path in paths_to_delete:
        try:
            supabase.storage.from_("datasets").remove([path])
        except Exception as e:
            logger.warning("Failed to delete pruned version file %s: %s", path, e)

    logger.info(
        "Created version v%d for dataset %s (run %s)",
        next_version, dataset_id, validation_run_id,
    )


def compute_version_diff(df_old: pd.DataFrame, df_new: pd.DataFrame) -> dict:
    """Compute row-level diff between two version DataFrames.

    Uses position-based (row index) comparison since the same dataset
    may not have a unique key column.

    Args:
        df_old: DataFrame from the older version.
        df_new: DataFrame from the newer version.

    Returns:
        Dict with 'summary' (counts) and 'added', 'removed', 'modified' arrays.
    """
    # Align columns (preserve order, include all)
    all_cols = list(dict.fromkeys(list(df_old.columns) + list(df_new.columns)))

    max_rows = max(len(df_old), len(df_new))
    added_rows = []
    removed_rows = []
    modified_rows = []

    for i in range(max_rows):
        if i >= len(df_old):
            # Row exists only in new version
            added_rows.append({
                "row": i + 1,
                "values": df_new.iloc[i].to_dict(),
            })
        elif i >= len(df_new):
            # Row exists only in old version
            removed_rows.append({
                "row": i + 1,
                "values": df_old.iloc[i].to_dict(),
            })
        else:
            # Row exists in both -- check for changes
            changes = {}
            for col in all_cols:
                old_val = str(df_old.iloc[i].get(col, "")) if col in df_old.columns else ""
                new_val = str(df_new.iloc[i].get(col, "")) if col in df_new.columns else ""
                if old_val != new_val:
                    changes[col] = {"old": old_val, "new": new_val}
            if changes:
                modified_rows.append({"row": i + 1, "changes": changes})

    return {
        "summary": {
            "rows_before": len(df_old),
            "rows_after": len(df_new),
            "added_count": len(added_rows),
            "removed_count": len(removed_rows),
            "modified_count": len(modified_rows),
            "columns_before": len(df_old.columns),
            "columns_after": len(df_new.columns),
        },
        "added": added_rows,
        "removed": removed_rows,
        "modified": modified_rows,
    }
