"""FastAPI router for context zone CRUD and preset management."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.dependencies import get_supabase_client
from app.models.schemas import ContextZoneDefinition
from app.services.context_zone_presets import get_preset_zones, create_zone_from_preset

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/zones", tags=["context-zones"])


# --- Request/Response models ---


class CreateZoneRequest(BaseModel):
    profile_id: str
    user_id: str
    org_id: str
    name: str
    description: str = ""
    zone_type: str
    kp_start: float | None = None
    kp_end: float | None = None
    event_value: str | None = None
    threshold_modifiers: dict[str, float] = {}
    sort_order: int = 0


class UpdateZoneRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    zone_type: str | None = None
    kp_start: float | None = None
    kp_end: float | None = None
    event_value: str | None = None
    threshold_modifiers: dict[str, float] | None = None
    sort_order: int | None = None
    enabled: bool | None = None


class ApplyPresetRequest(BaseModel):
    preset_id: str
    profile_id: str
    user_id: str
    org_id: str
    kp_start: float | None = None  # optional KP overrides
    kp_end: float | None = None


# --- Endpoints ---


@router.post("/", status_code=201)
def create_zone(body: CreateZoneRequest):
    """Create a new context zone."""
    # Validate zone definition
    try:
        ContextZoneDefinition(
            name=body.name,
            description=body.description,
            zone_type=body.zone_type,
            kp_start=body.kp_start,
            kp_end=body.kp_end,
            event_value=body.event_value,
            threshold_modifiers=body.threshold_modifiers,
        )
    except (ValidationError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Invalid zone definition: {e}")

    supabase = get_supabase_client()

    record = {
        "profile_id": body.profile_id,
        "user_id": body.user_id,
        "org_id": body.org_id,
        "name": body.name,
        "description": body.description,
        "zone_type": body.zone_type,
        "kp_start": body.kp_start,
        "kp_end": body.kp_end,
        "event_value": body.event_value,
        "threshold_modifiers": body.threshold_modifiers,
        "sort_order": body.sort_order,
    }

    result = supabase.table("context_zones").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create zone")

    created = result.data[0] if isinstance(result.data, list) else result.data
    return created


@router.get("/presets")
def list_presets():
    """Return all available preset zone templates."""
    return get_preset_zones()


@router.post("/presets/apply", status_code=201)
def apply_preset(body: ApplyPresetRequest):
    """Create a zone from a preset template with optional KP overrides."""
    zone_def = create_zone_from_preset(body.preset_id)
    if zone_def is None:
        raise HTTPException(status_code=404, detail=f"Preset '{body.preset_id}' not found")

    # Apply KP overrides if provided (for kp_range presets)
    kp_start = body.kp_start if body.kp_start is not None else zone_def.kp_start
    kp_end = body.kp_end if body.kp_end is not None else zone_def.kp_end

    supabase = get_supabase_client()

    record = {
        "profile_id": body.profile_id,
        "user_id": body.user_id,
        "org_id": body.org_id,
        "name": zone_def.name,
        "description": zone_def.description,
        "zone_type": zone_def.zone_type,
        "kp_start": kp_start,
        "kp_end": kp_end,
        "event_value": zone_def.event_value,
        "threshold_modifiers": zone_def.threshold_modifiers,
        "is_preset": True,
        "preset_id": body.preset_id,
    }

    result = supabase.table("context_zones").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create zone from preset")

    created = result.data[0] if isinstance(result.data, list) else result.data
    return created


@router.get("/")
def list_zones(profile_id: str):
    """List context zones for a validation profile, sorted by sort_order."""
    supabase = get_supabase_client()
    result = (
        supabase.table("context_zones")
        .select("*")
        .eq("profile_id", profile_id)
        .order("sort_order", desc=False)
        .execute()
    )
    return result.data or []


@router.get("/{zone_id}")
def get_zone(zone_id: str):
    """Get a single context zone by ID."""
    supabase = get_supabase_client()
    try:
        result = (
            supabase.table("context_zones")
            .select("*")
            .eq("id", zone_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Zone not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Zone not found")

    return result.data


@router.put("/{zone_id}")
def update_zone(zone_id: str, body: UpdateZoneRequest):
    """Update an existing context zone (partial update)."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate zone definition if zone_type-related fields are being updated
    zone_type_fields = {"zone_type", "kp_start", "kp_end", "event_value"}
    if zone_type_fields & updates.keys():
        # Fetch current zone to merge with updates for validation
        supabase = get_supabase_client()
        try:
            current = (
                supabase.table("context_zones")
                .select("*")
                .eq("id", zone_id)
                .single()
                .execute()
            )
        except Exception:
            raise HTTPException(status_code=404, detail="Zone not found")

        if not current.data:
            raise HTTPException(status_code=404, detail="Zone not found")

        merged = {**current.data, **updates}
        try:
            ContextZoneDefinition(
                name=merged["name"],
                zone_type=merged["zone_type"],
                kp_start=merged.get("kp_start"),
                kp_end=merged.get("kp_end"),
                event_value=merged.get("event_value"),
                threshold_modifiers=merged.get("threshold_modifiers", {}),
            )
        except (ValidationError, Exception) as e:
            raise HTTPException(status_code=422, detail=f"Invalid zone definition: {e}")

    supabase = get_supabase_client()
    result = (
        supabase.table("context_zones")
        .update(updates)
        .eq("id", zone_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Zone not found")

    updated = result.data[0] if isinstance(result.data, list) else result.data
    return updated


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str):
    """Delete a context zone."""
    supabase = get_supabase_client()
    supabase.table("context_zones").delete().eq("id", zone_id).execute()
    return None
