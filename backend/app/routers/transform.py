"""Transform endpoints -- CRS conversion, dataset merge, dataset split."""

import io
import json
import os
import zipfile
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.parsers import dispatch_parser
from app.parsers.base import ParseResult
from app.routers.conversion import WRITERS
from app.transforms._detect_crs import detect_crs_from_values
from app.transforms.crs import transform_crs
from app.transforms.merge import merge_datasets
from app.transforms.split import split_by_kp, split_by_column
from app.writers._coords import LON_NAMES, LAT_NAMES, find_column

router = APIRouter(prefix="/api/v1/transform", tags=["transform"])


def default_target_format(filename: str) -> str:
    """Derive output format from input filename extension, falling back to geojson."""
    _, ext = os.path.splitext(filename)
    ext = ext.lstrip(".").lower()
    if ext in WRITERS:
        return ext
    return "geojson"


def _write_output(result: ParseResult, target_format: str, base_name: str):
    """Write ParseResult to bytes using the specified format writer."""
    if target_format not in WRITERS:
        supported = ", ".join(sorted(WRITERS.keys()))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target format '{target_format}'. Supported: {supported}",
        )
    writer_fn, media_type, extension = WRITERS[target_format]
    output_bytes, write_warnings = writer_fn(result)
    output_filename = f"{base_name}{extension}"
    return output_bytes, write_warnings, media_type, output_filename


@router.post("/crs")
def transform_crs_endpoint(
    file: UploadFile = File(...),
    target_epsg: int = Form(...),
    source_epsg: Optional[int] = Form(None),
    target_format: Optional[str] = Form(None),
):
    """Transform coordinates from one CRS to another."""
    file_bytes = file.file.read()
    filename = file.filename or "unknown"

    # Determine output format
    fmt = target_format.strip().lower() if target_format else default_target_format(filename)

    # Parse input
    try:
        result = dispatch_parser(file_bytes, filename)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Auto-detect source CRS if not provided
    if source_epsg is None:
        x_idx = find_column(result.headers, LON_NAMES)
        y_idx = find_column(result.headers, LAT_NAMES)
        if x_idx is not None and y_idx is not None:
            x_vals = []
            y_vals = []
            for row in result.rows:
                try:
                    x_vals.append(float(row[x_idx]))
                    y_vals.append(float(row[y_idx]))
                except (ValueError, TypeError, IndexError):
                    continue
            detected_epsg, note = detect_crs_from_values(x_vals, y_vals)
            if detected_epsg is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not auto-detect source CRS: {note}. Please specify source_epsg.",
                )
            source_epsg = detected_epsg
        else:
            raise HTTPException(
                status_code=400,
                detail="No coordinate columns found and no source_epsg specified.",
            )

    # Transform
    transformed, warnings = transform_crs(result, source_epsg, target_epsg)

    # Write output
    base_name = os.path.splitext(filename)[0]
    output_bytes, write_warnings, media_type, output_filename = _write_output(
        transformed, fmt, base_name
    )
    all_warnings = warnings + write_warnings

    headers = {
        "Content-Disposition": f'attachment; filename="{output_filename}"',
        "X-Transform-Warnings": "|".join(all_warnings) if all_warnings else "",
        "X-Row-Count": str(transformed.total_rows),
        "X-Source-CRS": str(source_epsg),
        "X-Target-CRS": str(target_epsg),
        "X-Input-Format": fmt,
    }

    return StreamingResponse(
        io.BytesIO(output_bytes), media_type=media_type, headers=headers
    )


@router.post("/merge")
def merge_endpoint(
    files: list[UploadFile] = File(...),
    target_format: Optional[str] = Form(None),
):
    """Merge multiple uploaded files into a single output."""
    if len(files) < 2:
        raise HTTPException(
            status_code=400, detail="At least 2 files are required for merge."
        )

    # Determine output format from first file
    first_filename = files[0].filename or "unknown"
    fmt = target_format.strip().lower() if target_format else default_target_format(first_filename)

    # Parse all files
    results: list[ParseResult] = []
    for f in files:
        file_bytes = f.file.read()
        fname = f.filename or "unknown"
        try:
            results.append(dispatch_parser(file_bytes, fname))
        except (ValueError, Exception) as exc:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse '{fname}': {exc}"
            )

    # Merge
    merged, warnings = merge_datasets(results)

    # Write output
    base_name = os.path.splitext(first_filename)[0] + "_merged"
    output_bytes, write_warnings, media_type, output_filename = _write_output(
        merged, fmt, base_name
    )
    all_warnings = warnings + write_warnings

    headers = {
        "Content-Disposition": f'attachment; filename="{output_filename}"',
        "X-Transform-Warnings": "|".join(all_warnings) if all_warnings else "",
        "X-Row-Count": str(merged.total_rows),
        "X-Input-Format": fmt,
    }

    return StreamingResponse(
        io.BytesIO(output_bytes), media_type=media_type, headers=headers
    )


@router.post("/split")
def split_endpoint(
    file: UploadFile = File(...),
    mode: str = Form(...),
    target_format: Optional[str] = Form(None),
    column_name: Optional[str] = Form(None),
    ranges: Optional[str] = Form(None),
    single_value: Optional[str] = Form(None),
    single_range: Optional[str] = Form(None),
):
    """Split an uploaded file by KP range or column value.

    For multiple outputs, returns a ZIP archive.
    For single output (via single_value or single_range), returns a single file.
    """
    file_bytes = file.file.read()
    filename = file.filename or "unknown"
    fmt = target_format.strip().lower() if target_format else default_target_format(filename)
    base_name = os.path.splitext(filename)[0]

    # Parse input
    try:
        result = dispatch_parser(file_bytes, filename)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    mode = mode.strip().lower()
    warnings: list[str] = []

    if mode == "kp":
        if not ranges:
            raise HTTPException(
                status_code=400,
                detail="ranges parameter required for KP split mode (JSON array of [start, end] pairs).",
            )
        try:
            range_list = json.loads(ranges)
            range_tuples = [(float(r[0]), float(r[1])) for r in range_list]
        except (json.JSONDecodeError, IndexError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid ranges format: {exc}. Expected JSON array of [start, end] pairs.",
            )

        # Single range retrieval
        if single_range:
            try:
                sr = json.loads(single_range)
                single_tuple = (float(sr[0]), float(sr[1]))
            except (json.JSONDecodeError, IndexError, TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid single_range format.")
            splits, warnings = split_by_kp(result, [single_tuple])
        else:
            splits, warnings = split_by_kp(result, range_tuples)

    elif mode == "column":
        if not column_name:
            raise HTTPException(
                status_code=400,
                detail="column_name parameter required for column split mode.",
            )
        splits, warnings = split_by_column(result, column_name)

        # Single value retrieval
        if single_value:
            matching = [(label, part) for label, part in splits if label == single_value]
            if not matching:
                raise HTTPException(
                    status_code=404,
                    detail=f"No data found for value '{single_value}' in column '{column_name}'.",
                )
            splits = matching

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid split mode '{mode}'. Use 'kp' or 'column'.",
        )

    if not splits:
        raise HTTPException(
            status_code=400,
            detail=f"Split produced no results. {'; '.join(warnings)}",
        )

    # Single output -> return as file
    if len(splits) == 1 or single_value or single_range:
        label, part = splits[0]
        output_bytes, write_warnings, media_type, output_filename = _write_output(
            part, fmt, f"{base_name}_{label}"
        )
        all_warnings = warnings + write_warnings
        headers = {
            "Content-Disposition": f'attachment; filename="{output_filename}"',
            "X-Transform-Warnings": "|".join(all_warnings) if all_warnings else "",
            "X-Row-Count": str(part.total_rows),
            "X-Input-Format": fmt,
        }
        return StreamingResponse(
            io.BytesIO(output_bytes), media_type=media_type, headers=headers
        )

    # Multiple outputs -> ZIP
    zip_buffer = io.BytesIO()
    file_names: list[str] = []
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for label, part in splits:
            output_bytes, write_warnings, _, out_fn = _write_output(
                part, fmt, f"{base_name}_{label}"
            )
            warnings.extend(write_warnings)
            zf.writestr(out_fn, output_bytes)
            file_names.append(out_fn)

    zip_buffer.seek(0)
    zip_filename = f"{base_name}_split.zip"

    headers = {
        "Content-Disposition": f'attachment; filename="{zip_filename}"',
        "X-Transform-Warnings": "|".join(warnings) if warnings else "",
        "X-Split-Files": "|".join(file_names),
        "X-Input-Format": fmt,
    }

    return StreamingResponse(
        zip_buffer, media_type="application/zip", headers=headers
    )
