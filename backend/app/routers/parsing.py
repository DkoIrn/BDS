"""Parse endpoint -- dispatches uploaded files to format-specific parsers."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.dependencies import get_supabase_client
from app.parsers import dispatch_parser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["parsing"])


class ParseRequest(BaseModel):
    dataset_id: str


def parse_dataset_file(dataset_id: str) -> dict:
    """Core parse logic, separated from HTTP layer for testability.

    Downloads file from Supabase Storage, dispatches to the correct parser,
    updates the dataset record, and returns the response payload.

    Raises:
        HTTPException: On dataset not found or parse failure.
    """
    supabase = get_supabase_client()

    # Fetch dataset record
    result = supabase.table("datasets").select("*").eq("id", dataset_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = result.data

    try:
        # Download file from storage
        file_bytes = supabase.storage.from_("datasets").download(dataset["storage_path"])

        # Dispatch to format-specific parser
        parse_result = dispatch_parser(file_bytes, dataset["file_name"])

        # Build column mappings from headers (index, originalName, mappedType=null, ignored=false)
        column_mappings = [
            {
                "index": i,
                "originalName": header,
                "mappedType": None,
                "ignored": False,
            }
            for i, header in enumerate(parse_result.headers)
        ]

        # Build preview (up to 250 rows)
        preview = parse_result.rows[:250]

        # Build parsed_metadata
        parsed_metadata = {
            "source_format": parse_result.source_format,
            "originalColumnCount": len(parse_result.headers),
            "detectedStartRow": 0,
            **parse_result.metadata,
        }

        # Update dataset record
        supabase.table("datasets").update({
            "status": "parsed",
            "header_row_index": 0,
            "total_rows": parse_result.total_rows,
            "parsed_metadata": parsed_metadata,
            "column_mappings": column_mappings,
            "parse_warnings": parse_result.warnings if parse_result.warnings else None,
        }).eq("id", dataset_id).execute()

        return {
            "columns": [
                {
                    "index": i,
                    "originalName": header,
                    "detectedType": None,
                    "confidence": "low",
                    "dataPreview": [row[i] if i < len(row) else "" for row in preview[:5]],
                }
                for i, header in enumerate(parse_result.headers)
            ],
            "preview": preview,
            "headerRow": 0,
            "totalRows": parse_result.total_rows,
            "warnings": parse_result.warnings,
        }

    except ValueError as e:
        # Unsupported format or parser error
        error_message = str(e)
        logger.error("Parse failed for dataset %s: %s", dataset_id, error_message)

        supabase.table("datasets").update({
            "status": "error",
            "parse_warnings": [error_message],
        }).eq("id", dataset_id).execute()

        raise HTTPException(status_code=400, detail=error_message)

    except Exception as e:
        # Unexpected error -- still update status to prevent stuck state
        error_message = str(e) if str(e) else "Parse failed"
        logger.error("Parse failed for dataset %s: %s", dataset_id, error_message)

        try:
            supabase.table("datasets").update({
                "status": "error",
                "parse_warnings": [error_message],
            }).eq("id", dataset_id).execute()
        except Exception as update_err:
            logger.error("Failed to update error status: %s", str(update_err))

        raise HTTPException(status_code=500, detail=error_message)


@router.post("/parse")
def parse_dataset(request: ParseRequest):
    """Parse a dataset file and store the results.

    Accepts a dataset_id, downloads the file from Supabase Storage,
    dispatches to the correct parser based on file extension, and
    updates the dataset record with parsed results.
    """
    return parse_dataset_file(request.dataset_id)
