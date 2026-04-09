"""Default validation profile templates and config resolution helpers."""

from app.models.schemas import EnabledChecks, ProfileConfig, RangeThreshold


# ---------------------------------------------------------------------------
# Default templates keyed by slug
# ---------------------------------------------------------------------------
DEFAULT_TEMPLATES: dict[str, ProfileConfig] = {
    "pipeline-as-laid": ProfileConfig(
        ranges={
            "dob": RangeThreshold(min=0, max=3, tolerance=0.1),
            "depth": RangeThreshold(min=0, max=300),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        kp_gap_max=0.01,
        duplicate_kp_tolerance=0.0005,
        monotonicity_check=True,
        kp_drift_tolerance=0.01,
        max_segment_distance=50.0,
        kp_drift_severity="critical",
        segment_continuity_severity="warning",
        zscore_threshold=2.5,
        iqr_multiplier=1.5,
        enabled_checks=EnabledChecks(),
    ),
    "as-built-survey": ProfileConfig(
        ranges={
            "doc": RangeThreshold(min=0, max=2, tolerance=0.05),
            "dob": RangeThreshold(min=0, max=5),
            "depth": RangeThreshold(min=0, max=300),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        kp_gap_max=0.05,
        duplicate_kp_tolerance=0.001,
        monotonicity_check=True,
        kp_drift_tolerance=0.02,
        max_segment_distance=100.0,
        kp_drift_severity="warning",
        segment_continuity_severity="critical",
        zscore_threshold=2.0,
        iqr_multiplier=1.5,
        enabled_checks=EnabledChecks(),
    ),
    "pre-commissioning": ProfileConfig(
        ranges={
            "dob": RangeThreshold(min=0, max=10),
            "doc": RangeThreshold(min=0, max=10),
            "depth": RangeThreshold(min=0, max=500),
            "easting": RangeThreshold(min=100000, max=900000),
            "northing": RangeThreshold(min=0, max=10000000),
        },
        kp_gap_max=0.1,
        duplicate_kp_tolerance=0.002,
        monotonicity_check=True,
        kp_drift_tolerance=0.05,
        max_segment_distance=200.0,
        kp_drift_severity="warning",
        segment_continuity_severity="warning",
        zscore_threshold=3.0,
        iqr_multiplier=1.5,
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
        kp_drift_tolerance=0.03,
        max_segment_distance=150.0,
        kp_drift_severity="warning",
        segment_continuity_severity="warning",
        enabled_checks=EnabledChecks(),
    ),
}


# ---------------------------------------------------------------------------
# Template metadata for frontend consumption
# ---------------------------------------------------------------------------
TEMPLATE_METADATA: list[dict] = [
    {
        "id": "pipeline-as-laid",
        "name": "Pipeline As-Laid QC",
        "survey_type": "pipeline",
        "description": "Tight KP and depth-of-burial checks for as-laid pipeline surveys. Critical KP drift detection.",
        "expectedColumns": ["kp", "dob", "depth", "easting", "northing"],
    },
    {
        "id": "as-built-survey",
        "name": "As-Built Survey QC",
        "survey_type": "as-built",
        "description": "DOC and cross-column focus for construction verification. Aggressive spike detection, critical segment continuity.",
        "expectedColumns": ["kp", "doc", "dob", "depth", "easting", "northing"],
    },
    {
        "id": "pre-commissioning",
        "name": "Pre-Commissioning QC",
        "survey_type": "pre-comm",
        "description": "Event listing and position consistency focus for pre-commissioning surveys. Looser depth tolerances.",
        "expectedColumns": ["kp", "dob", "depth", "easting", "northing", "event_listing"],
    },
    {
        "id": "general-survey",
        "name": "General Survey QC",
        "survey_type": "general",
        "description": "General-purpose pack with generous limits for all numeric column types. Suitable for any survey data.",
        "expectedColumns": [],
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

    # Flatten ranges into {col_type}_min / {col_type}_max / {col_type}_tolerance keys
    for col_type, threshold in config.ranges.items():
        flat[f"{col_type}_min"] = threshold.min
        flat[f"{col_type}_max"] = threshold.max
        if threshold.tolerance > 0:
            flat[f"{col_type}_tolerance"] = threshold.tolerance

    # Scalar thresholds
    flat["zscore_threshold"] = config.zscore_threshold
    flat["iqr_multiplier"] = config.iqr_multiplier
    flat["kp_gap_max"] = config.kp_gap_max
    flat["duplicate_kp_tolerance"] = config.duplicate_kp_tolerance

    # Chain-aware check config
    flat["kp_drift_tolerance"] = config.kp_drift_tolerance
    flat["max_segment_distance"] = config.max_segment_distance
    flat["kp_drift_severity"] = config.kp_drift_severity
    flat["segment_continuity_severity"] = config.segment_continuity_severity

    # Enabled checks as plain dict
    enabled = config.enabled_checks.model_dump()

    return flat, enabled
