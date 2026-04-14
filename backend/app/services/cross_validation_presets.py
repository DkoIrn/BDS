"""Cross-validation preset definitions for comparing two related survey datasets.

Presets define which columns to compare, what checks to run, and default
tolerances for each dataset type pair (e.g., DOB vs DOC, Position vs Event).
"""

from dataclasses import dataclass, field


@dataclass
class CrossValidationPreset:
    id: str
    name: str
    dataset_a_type: str  # e.g., "DOB"
    dataset_b_type: str  # e.g., "DOC"
    column_pairs: list[dict] = field(default_factory=list)
    # [{"a": "dob", "b": "doc", "check": "delta"|"a_gte_b"|"coverage",
    #   "tolerance": 0.1, "description": "..."}]
    kp_alignment_tolerance: float = 0.01  # km


PRESETS: dict[str, CrossValidationPreset] = {
    "dob_vs_doc": CrossValidationPreset(
        id="dob_vs_doc",
        name="DOB vs DOC Consistency",
        dataset_a_type="DOB",
        dataset_b_type="DOC",
        column_pairs=[
            {
                "a": "kp",
                "b": "kp",
                "check": "coverage",
                "description": "KP coverage alignment",
            },
            {
                "a": "dob",
                "b": "doc",
                "check": "a_gte_b",
                "tolerance": 0.0,
                "description": "DOB >= DOC (burial must exceed cover)",
            },
            {
                "a": "dob",
                "b": "dob",
                "check": "delta",
                "tolerance": 0.1,
                "description": "DOB agreement between surveys",
            },
            {
                "a": "easting",
                "b": "easting",
                "check": "delta",
                "tolerance": 1.0,
                "description": "Easting agreement",
            },
            {
                "a": "northing",
                "b": "northing",
                "check": "delta",
                "tolerance": 1.0,
                "description": "Northing agreement",
            },
        ],
        kp_alignment_tolerance=0.01,
    ),
    "position_vs_event": CrossValidationPreset(
        id="position_vs_event",
        name="Position vs Event Alignment",
        dataset_a_type="Position",
        dataset_b_type="Event Listing",
        column_pairs=[
            {
                "a": "kp",
                "b": "kp",
                "check": "coverage",
                "description": "Events have matching positions",
            },
            {
                "a": "easting",
                "b": "easting",
                "check": "delta",
                "tolerance": 5.0,
                "description": "Position agreement at event KPs",
            },
            {
                "a": "northing",
                "b": "northing",
                "check": "delta",
                "tolerance": 5.0,
                "description": "Position agreement at event KPs",
            },
        ],
        kp_alignment_tolerance=0.05,
    ),
}


# Column name synonyms for auto-detection
COLUMN_SYNONYMS: dict[str, list[str]] = {
    "kp": ["kp", "chainage", "station", "km_point", "kilometre_point"],
    "dob": ["dob", "depth_of_burial", "burial_depth", "burial"],
    "doc": ["doc", "depth_of_cover", "cover_depth", "cover"],
    "easting": ["easting", "east", "e", "x"],
    "northing": ["northing", "north", "n", "y"],
    "depth": ["depth", "water_depth", "seabed_depth"],
    "top": ["top", "top_of_pipe", "pipe_top"],
    "event": ["event", "event_code", "event_type"],
    "event_description": ["event_description", "event_desc", "description"],
}


def auto_match_columns(
    headers_a: list[str],
    headers_b: list[str],
) -> list[dict]:
    """Match columns between two datasets using synonym lookup.

    Returns list of dicts: [{"type": "kp", "col_a": "KP", "col_b": "Chainage"}, ...]
    """
    matches: list[dict] = []

    normalized_a = {h: h.lower().strip().replace(" ", "_") for h in headers_a}
    normalized_b = {h: h.lower().strip().replace(" ", "_") for h in headers_b}

    for col_type, synonyms in COLUMN_SYNONYMS.items():
        match_a = next(
            (orig for orig, norm in normalized_a.items() if norm in synonyms),
            None,
        )
        match_b = next(
            (orig for orig, norm in normalized_b.items() if norm in synonyms),
            None,
        )
        if match_a and match_b:
            matches.append({"type": col_type, "col_a": match_a, "col_b": match_b})

    return matches


def get_preset_for_types(
    type_a: str,
    type_b: str,
) -> CrossValidationPreset | None:
    """Auto-select a preset from dataset type label pair.

    Tries both orderings (a,b) and (b,a).
    """
    for preset in PRESETS.values():
        if (
            preset.dataset_a_type.lower() == type_a.lower()
            and preset.dataset_b_type.lower() == type_b.lower()
        ):
            return preset
        if (
            preset.dataset_a_type.lower() == type_b.lower()
            and preset.dataset_b_type.lower() == type_a.lower()
        ):
            return preset
    return None
