"""Compare endpoint -- diff two datasets with tolerance thresholds."""

import json
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.parsers import dispatch_parser
from app.transforms.compare import compare_datasets

router = APIRouter(prefix="/api/v1/compare", tags=["compare"])


@router.post("")
def compare_endpoint(
    base_file: UploadFile = File(...),
    compare_file: UploadFile = File(...),
    key_columns: str = Form(...),
    tolerance: Optional[float] = Form(0.0),
    compare_columns: Optional[str] = Form(None),
):
    """Compare two datasets row-by-row using key columns for matching.

    Args:
        base_file: The reference/as-designed dataset.
        compare_file: The as-built dataset to compare against.
        key_columns: JSON array of column names to use as row identifiers.
        tolerance: Numeric tolerance for float comparisons (default 0.0).
        compare_columns: Optional JSON array of specific columns to compare.
    """
    # Parse key columns
    try:
        key_cols = json.loads(key_columns)
        if not isinstance(key_cols, list) or not key_cols:
            raise ValueError("key_columns must be a non-empty array")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid key_columns: {exc}")

    # Parse compare columns
    comp_cols = None
    if compare_columns:
        try:
            comp_cols = json.loads(compare_columns)
            if not isinstance(comp_cols, list):
                raise ValueError("compare_columns must be an array")
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid compare_columns: {exc}")

    # Parse both files
    base_bytes = base_file.file.read()
    base_name = base_file.filename or "base"
    try:
        base_result = dispatch_parser(base_bytes, base_name)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse base file: {exc}")

    comp_bytes = compare_file.file.read()
    comp_name = compare_file.filename or "compare"
    try:
        comp_result = dispatch_parser(comp_bytes, comp_name)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse compare file: {exc}")

    # Run comparison
    tol = tolerance if tolerance is not None else 0.0
    try:
        result = compare_datasets(base_result, comp_result, key_cols, tol, comp_cols)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return JSONResponse(content={
        "summary": result.summary,
        "matched_rows": result.matched_rows,
        "mismatched_rows": result.mismatched_rows,
        "only_in_base": result.only_in_base,
        "only_in_compare": result.only_in_compare,
        "headers": result.headers,
        "warnings": result.warnings,
    })
