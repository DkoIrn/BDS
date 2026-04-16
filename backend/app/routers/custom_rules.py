"""FastAPI router for custom validation rules CRUD and test execution."""

import io
import logging

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.dependencies import get_supabase_client
from app.models.schemas import ConditionGroup, CustomRuleDefinition
from app.services.custom_rules import execute_custom_rule

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rules", tags=["custom-rules"])

MAX_TEST_ROWS = 10_000
MAX_SAMPLE_MATCHES = 50


# --- Request/Response models ---


class CreateRuleRequest(BaseModel):
    profile_id: str
    user_id: str
    org_id: str
    name: str
    description: str = ""
    severity: str = "warning"
    rule_definition: dict  # ConditionGroup JSON


class UpdateRuleRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    severity: str | None = None
    rule_definition: dict | None = None
    enabled: bool | None = None


class TestRuleRequest(BaseModel):
    rule_definition: dict  # ConditionGroup JSON
    dataset_id: str
    severity: str = "warning"
    name: str = "Test rule"


# --- Endpoints ---


@router.post("/", status_code=201)
def create_rule(body: CreateRuleRequest):
    """Create a new custom validation rule."""
    # Validate rule_definition by parsing as CustomRuleDefinition
    try:
        group = ConditionGroup(**body.rule_definition)
        CustomRuleDefinition(
            name=body.name,
            description=body.description,
            severity=body.severity,
            root_group=group,
        )
    except (ValidationError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Invalid rule definition: {e}")

    supabase = get_supabase_client()

    record = {
        "profile_id": body.profile_id,
        "user_id": body.user_id,
        "org_id": body.org_id,
        "name": body.name,
        "description": body.description,
        "severity": body.severity,
        "rule_definition": body.rule_definition,
    }

    result = supabase.table("custom_rules").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create rule")

    created = result.data[0] if isinstance(result.data, list) else result.data
    return created


@router.get("/")
def list_rules(profile_id: str):
    """List custom rules for a validation profile."""
    supabase = get_supabase_client()
    result = (
        supabase.table("custom_rules")
        .select("*")
        .eq("profile_id", profile_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.put("/{rule_id}")
def update_rule(rule_id: str, body: UpdateRuleRequest):
    """Update an existing custom rule (partial update)."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate rule_definition if provided
    if "rule_definition" in updates:
        try:
            group = ConditionGroup(**updates["rule_definition"])
            CustomRuleDefinition(
                name="validation_check",
                root_group=group,
            )
        except (ValidationError, Exception) as e:
            raise HTTPException(status_code=422, detail=f"Invalid rule definition: {e}")

    supabase = get_supabase_client()
    result = (
        supabase.table("custom_rules")
        .update(updates)
        .eq("id", rule_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Rule not found")

    updated = result.data[0] if isinstance(result.data, list) else result.data
    return updated


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: str):
    """Delete a custom rule."""
    supabase = get_supabase_client()
    supabase.table("custom_rules").delete().eq("id", rule_id).execute()
    return None


@router.post("/test")
def test_rule(body: TestRuleRequest):
    """Test a rule against a dataset without saving.

    Returns matching row count and sample matches for preview.
    """
    # Parse and validate rule definition
    try:
        group = ConditionGroup(**body.rule_definition)
        rule = CustomRuleDefinition(
            name=body.name,
            severity=body.severity,
            root_group=group,
        )
    except (ValidationError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Invalid rule definition: {e}")

    supabase = get_supabase_client()

    # Fetch dataset record
    try:
        ds_result = (
            supabase.table("datasets")
            .select("*")
            .eq("id", body.dataset_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not ds_result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset = ds_result.data

    # Download and parse file
    try:
        file_bytes = supabase.storage.from_("datasets").download(dataset["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download dataset: {e}")

    file_name = dataset.get("file_name", "data.csv")
    try:
        if file_name.endswith(".csv"):
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse dataset: {e}")

    # Apply column mappings
    mappings = dataset.get("column_mappings", []) or []
    rename_map = {}
    for m in mappings:
        if m.get("mappedType") and not m.get("ignored"):
            rename_map[m["originalName"]] = m["mappedType"]
    df = df.rename(columns=rename_map)

    # Convert numeric columns
    numeric_types = {
        "kp", "easting", "northing", "depth", "dob", "doc",
        "top", "elevation", "latitude", "longitude",
    }
    for col in df.columns:
        if col in numeric_types:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Cap rows for performance
    total_rows = len(df)
    truncated = total_rows > MAX_TEST_ROWS
    if truncated:
        df = df.head(MAX_TEST_ROWS)

    # Find KP column
    kp_column = None
    for m in mappings:
        if m.get("mappedType") == "kp" and not m.get("ignored"):
            kp_column = "kp"
            break

    # Execute rule
    issues = execute_custom_rule(df, rule, kp_column=kp_column)

    # Build sample matches (first N matching rows with relevant column values)
    sample_matches = []
    for issue in issues[:MAX_SAMPLE_MATCHES]:
        row_idx = issue.row_number - 1  # back to 0-based for DataFrame access
        if 0 <= row_idx < len(df):
            row_data = df.iloc[row_idx].to_dict()
            # Convert NaN/NaT to None for JSON serialization
            clean_data = {
                k: (None if pd.isna(v) else v) for k, v in row_data.items()
            }
            sample_matches.append({
                "row_number": issue.row_number,
                "values": clean_data,
            })

    return {
        "matching_rows": len(issues),
        "total_rows": total_rows,
        "truncated": truncated,
        "sample_matches": sample_matches,
    }
