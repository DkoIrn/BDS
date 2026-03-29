"""Format conversion endpoint -- accepts file upload + target format, returns converted file."""

import io
import os
from typing import Callable

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.parsers import dispatch_parser
from app.parsers.base import ParseResult
from app.writers.csv_writer import write_csv
from app.writers.geojson_writer import write_geojson
from app.writers.kml_writer import write_kml

router = APIRouter(prefix="/api/v1", tags=["conversion"])

# Maps target_format string to (writer_fn, media_type, file_extension)
WRITERS: dict[str, tuple[Callable[[ParseResult], tuple[bytes, list[str]]], str, str]] = {
    "csv": (write_csv, "text/csv", ".csv"),
    "geojson": (write_geojson, "application/geo+json", ".geojson"),
    "kml": (write_kml, "application/vnd.google-earth.kml+xml", ".kml"),
}


@router.post("/convert")
def convert_file(
    file: UploadFile = File(...),
    target_format: str = Form(...),
):
    """Convert an uploaded file to the requested target format.

    Accepts any format supported by dispatch_parser and converts to
    CSV, GeoJSON, or KML.
    """
    # Validate target format
    target_format = target_format.strip().lower()
    if target_format not in WRITERS:
        supported = ", ".join(sorted(WRITERS.keys()))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target format '{target_format}'. Supported: {supported}",
        )

    # Read file bytes
    file_bytes = file.file.read()
    filename = file.filename or "unknown"

    # Parse input file
    try:
        parse_result = dispatch_parser(file_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse file '{filename}': {exc}",
        )

    # Convert to target format
    writer_fn, media_type, extension = WRITERS[target_format]
    output_bytes, warnings = writer_fn(parse_result)

    # Build output filename: input basename + new extension
    base_name = os.path.splitext(filename)[0]
    output_filename = f"{base_name}{extension}"

    # Build response with metadata headers
    headers = {
        "Content-Disposition": f'attachment; filename="{output_filename}"',
        "X-Conversion-Warnings": "|".join(warnings) if warnings else "",
        "X-Row-Count": str(parse_result.total_rows),
        "X-Source-Format": parse_result.source_format,
    }

    return StreamingResponse(
        io.BytesIO(output_bytes),
        media_type=media_type,
        headers=headers,
    )
