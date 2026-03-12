"""Default validation profile templates and config resolution helpers."""

from app.models.schemas import EnabledChecks, ProfileConfig, RangeThreshold


# ---------------------------------------------------------------------------
# Default templates keyed by slug
# ---------------------------------------------------------------------------
DEFAULT_TEMPLATES: dict[str, ProfileConfig] = {
    "dob-survey": ProfileConfig(
        ranges={
            "dob": RangeThreshold(min=0, max=5),
            "depth": RangeThreshold(min=0, max=500),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        enabled_checks=EnabledChecks(),
    ),
    "doc-survey": ProfileConfig(
        ranges={
            "doc": RangeThreshold(min=0, max=3),
            "depth": RangeThreshold(min=0, max=500),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        enabled_checks=EnabledChecks(),
    ),
    "top-survey": ProfileConfig(
        ranges={
            "top": RangeThreshold(min=-200, max=200),
            "depth": RangeThreshold(min=0, max=500),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        enabled_checks=EnabledChecks(),
    ),
    "general-survey": ProfileConfig(
        ranges={
            "dob": RangeThreshold(min=0, max=10),
            "doc": RangeThreshold(min=0, max=10),
            "top": RangeThreshold(min=-500, max=500),
            "depth": RangeThreshold(min=0, max=500),
            "elevation": RangeThreshold(min=-500, max=500),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
            "latitude": RangeThreshold(min=-90, max=90),
            "longitude": RangeThreshold(min=-180, max=180),
        },
        enabled_checks=EnabledChecks(),
    ),
}


# ---------------------------------------------------------------------------
# Template metadata for frontend consumption
# ---------------------------------------------------------------------------
TEMPLATE_METADATA: list[dict] = [
    {
        "id": "dob-survey",
        "name": "DOB Survey",
        "survey_type": "dob",
        "description": "Depth of Burial survey with tight DOB range (0-5m) and standard position checks.",
    },
    {
        "id": "doc-survey",
        "name": "DOC Survey",
        "survey_type": "doc",
        "description": "Depth of Cover survey with tight DOC range (0-3m) and standard position checks.",
    },
    {
        "id": "top-survey",
        "name": "TOP Survey",
        "survey_type": "top",
        "description": "Top of Pipe survey with TOP range (-200 to 200m) and standard position checks.",
    },
    {
        "id": "general-survey",
        "name": "General Survey",
        "survey_type": "general",
        "description": "General-purpose template with generous limits for all 9 numeric column types.",
    },
]


# ---------------------------------------------------------------------------
# Config resolution: ProfileConfig -> (flat_config_dict, enabled_checks_dict)
# ---------------------------------------------------------------------------
def resolve_config(config: ProfileConfig) -> tuple[dict, dict]:
    """Convert a ProfileConfig to (flat_config_dict, enabled_checks_dict).

    flat_config_dict has keys like "dob_min", "dob_max", "zscore_threshold", etc.
    enabled_checks_dict has keys like "range_check", "missing_data", etc.
    """
    flat: dict = {}

    # Flatten ranges into {col_type}_min / {col_type}_max keys
    for col_type, threshold in config.ranges.items():
        flat[f"{col_type}_min"] = threshold.min
        flat[f"{col_type}_max"] = threshold.max

    # Scalar thresholds
    flat["zscore_threshold"] = config.zscore_threshold
    flat["iqr_multiplier"] = config.iqr_multiplier
    flat["kp_gap_max"] = config.kp_gap_max
    flat["duplicate_kp_tolerance"] = config.duplicate_kp_tolerance

    # Enabled checks as plain dict
    enabled = config.enabled_checks.model_dump()

    return flat, enabled
