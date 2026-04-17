"""Pre-configured domain zone templates for common pipeline scenarios."""

from __future__ import annotations

from app.models.schemas import ContextZoneDefinition

PRESET_ZONES: dict[str, dict] = {
    "shore-approach": {
        "name": "Shore Approach",
        "description": "Relaxed depth/DOB thresholds near shore (KP 0-2)",
        "zone_type": "kp_range",
        "kp_start": 0.0,
        "kp_end": 2.0,
        "threshold_modifiers": {
            "dob_max": 1.5,    # 50% more lenient on DOB max
            "depth_max": 1.3,  # 30% more lenient on depth
        },
    },
    "trench-crossing": {
        "name": "Trench Crossing",
        "description": "Relaxed DOB thresholds during trench crossings",
        "zone_type": "event_match",
        "event_value": "trench crossing",
        "threshold_modifiers": {
            "dob_max": 2.0,    # Double DOB tolerance
            "depth_max": 1.5,
        },
    },
    "j-tube": {
        "name": "J-Tube Entry/Exit",
        "description": "Tighter DOB/DOC thresholds at J-tube transitions",
        "zone_type": "event_match",
        "event_value": "j-tube",
        "threshold_modifiers": {
            "dob_max": 0.7,    # 30% tighter DOB
            "doc_max": 0.7,
        },
    },
    "span": {
        "name": "Free Span",
        "description": "Relaxed DOB but tighter depth monitoring at spans",
        "zone_type": "event_match",
        "event_value": "span",
        "threshold_modifiers": {
            "dob_max": 3.0,     # DOB expected to be 0 at spans
            "depth_max": 0.9,   # Slightly tighter depth
        },
    },
}


def get_preset_zones() -> dict[str, dict]:
    """Return all available preset zone templates."""
    return dict(PRESET_ZONES)


def create_zone_from_preset(preset_id: str) -> ContextZoneDefinition | None:
    """Create a ContextZoneDefinition from a preset template.

    Returns None if preset_id is not found.
    """
    preset = PRESET_ZONES.get(preset_id)
    if not preset:
        return None

    return ContextZoneDefinition(
        name=preset["name"],
        description=preset.get("description", ""),
        zone_type=preset["zone_type"],
        kp_start=preset.get("kp_start"),
        kp_end=preset.get("kp_end"),
        event_value=preset.get("event_value"),
        threshold_modifiers=preset.get("threshold_modifiers", {}),
    )
