"""FastAPI router for PDF report generation and annotated dataset export."""

import io
import logging
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.dependencies import get_supabase_client
from app.services.dataset_export import export_annotated_csv, export_annotated_excel
from app.services.report_builder import generate_pdf_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["reports"])


@router.get("/report/pdf/{run_id}")
def get_pdf_report(run_id: str):
    """Generate and return a PDF QC report for a validation run.

    Fetches run data, issues, and dataset info from Supabase, then
    generates a branded PDF report with summary, methodology, and
    issues table sections.
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

    # Fetch all issues for this run, ordered by row_number
    issues_result = (
        supabase.table("validation_issues")
        .select("*")
        .eq("run_id", run_id)
        .order("row_number")
        .execute()
    )
    issues = issues_result.data if issues_result.data else []

    # Fetch dataset record for the file name
    dataset_id = run_data.get("dataset_id", "")
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
            pass  # Use default name if dataset lookup fails

    # Generate PDF
    pdf_bytes = generate_pdf_report(run_data, issues, dataset_name)

    short_id = run_id[:8]
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="qc-report-{short_id}.pdf"'
        },
    )


@router.get("/export/dataset/{dataset_id}")
def export_dataset(
    dataset_id: str,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    run_id: str | None = Query(default=None),
):
    """Export an annotated dataset with QC flag columns.

    Supports CSV and Excel formats. When format=xlsx, flagged rows are
    highlighted with red (critical) or yellow (warning) cell fills.

    If run_id is not provided, uses the latest validation run for the dataset.
    """
    supabase = get_supabase_client()

    # Fetch dataset record
    try:
        ds_result = (
            supabase.table("datasets")
            .select("*")
            .eq("id", dataset_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not ds_result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = ds_result.data

    # Download file from Supabase Storage
    try:
        file_bytes = supabase.storage.from_("datasets").download(dataset["storage_path"])
    except Exception as e:
        logger.error("Failed to download dataset file: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to download dataset file")

    # Parse into DataFrame (same pattern as validation router)
    file_name = dataset.get("file_name", "")
    header_row_index = dataset.get("header_row_index", 0)

    if file_name.endswith(".csv"):
        df = pd.read_csv(
            io.BytesIO(file_bytes),
            header=header_row_index,
            dtype=str,
        )
    else:
        df = pd.read_excel(
            io.BytesIO(file_bytes),
            header=header_row_index,
            dtype=str,
        )

    # Resolve run_id: use provided or fetch latest
    if not run_id:
        runs_result = (
            supabase.table("validation_runs")
            .select("id")
            .eq("dataset_id", dataset_id)
            .order("run_at", desc=True)
            .limit(1)
            .execute()
        )
        if runs_result.data and len(runs_result.data) > 0:
            run_id = runs_result.data[0]["id"]

    # Fetch issues for the resolved run
    issues = []
    if run_id:
        issues_result = (
            supabase.table("validation_issues")
            .select("*")
            .eq("run_id", run_id)
            .order("row_number")
            .execute()
        )
        issues = issues_result.data if issues_result.data else []

    # Generate export
    file_stem = Path(file_name).stem if file_name else "dataset"

    if format == "xlsx":
        output = export_annotated_excel(df, issues)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{file_stem}-annotated.xlsx"'
            },
        )
    else:
        output = export_annotated_csv(df, issues)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{file_stem}-annotated.csv"'
            },
        )
