"""Context-aware QC: zone-based threshold modification for validation."""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from app.services.validation import run_validation_pipeline
from app.validators.base import ValidationIssue


@dataclass
class ContextZone:
    """A zone definition with threshold modifiers."""

    id: str
    name: str
    zone_type: str  # "kp_range" or "event_match"
    kp_start: float | None = None
    kp_end: float | None = None
    event_value: str | None = None
    threshold_modifiers: dict[str, float] = field(default_factory=dict)
    sort_order: int = 0


def load_zones(supabase, zone_ids: list[str]) -> list[ContextZone]:
    """Fetch context zones from DB and return sorted by sort_order."""
    if not zone_ids:
        return []

    result = (
        supabase.table("context_zones")
        .select("*")
        .in_("id", zone_ids)
        .eq("enabled", True)
        .execute()
    )

    zones = []
    for row in result.data or []:
        zones.append(
            ContextZone(
                id=row["id"],
                name=row["name"],
                zone_type=row["zone_type"],
                kp_start=row.get("kp_start"),
                kp_end=row.get("kp_end"),
                event_value=row.get("event_value"),
                threshold_modifiers=row.get("threshold_modifiers", {}),
                sort_order=row.get("sort_order", 0),
            )
        )

    zones.sort(key=lambda z: z.sort_order)
    return zones


def apply_context_zones(
    df: pd.DataFrame,
    column_mappings: list[dict],
    base_config: dict,
    enabled_checks: dict,
    zones: list[ContextZone],
    kp_column: str | None,
) -> list[ValidationIssue]:
    """Run validation with context-aware thresholds.

    For each zone, creates a modified config, filters DataFrame rows,
    and runs validators on that subset. Non-zone rows use base config.
    Uses first-match-wins: once a row is claimed by a zone, later zones skip it.
    """
    if not zones:
        return run_validation_pipeline(df, column_mappings, base_config, enabled_checks)

    all_issues: list[ValidationIssue] = []
    covered_indices: set[int] = set()

    # Process zones in sort_order (already sorted by load_zones or caller)
    for zone in zones:
        zone_mask = _get_zone_mask(df, zone, kp_column, column_mappings)

        # Exclude already-covered rows (first-match-wins)
        if covered_indices:
            already_covered = df.index.isin(covered_indices)
            zone_mask = zone_mask & ~already_covered

        if not zone_mask.any():
            continue

        zone_df = df[zone_mask].copy()
        covered_indices.update(zone_df.index)

        # Apply threshold modifiers to base config
        zone_config = _modify_config(base_config, zone.threshold_modifiers)

        zone_issues = run_validation_pipeline(
            zone_df, column_mappings, zone_config, enabled_checks
        )

        # Tag issues with zone context
        for issue in zone_issues:
            issue.message = f"[{zone.name}] {issue.message}"

        all_issues.extend(zone_issues)

    # Run base config on uncovered rows
    uncovered_mask = ~df.index.isin(covered_indices)
    if uncovered_mask.any():
        uncovered_df = df[uncovered_mask].copy()
        all_issues.extend(
            run_validation_pipeline(
                uncovered_df, column_mappings, base_config, enabled_checks
            )
        )

    return all_issues


def _get_zone_mask(
    df: pd.DataFrame,
    zone: ContextZone,
    kp_column: str | None,
    column_mappings: list[dict] | None = None,
) -> pd.Series:
    """Return boolean mask for rows matching a zone."""
    if zone.zone_type == "kp_range" and kp_column and kp_column in df.columns:
        kp = pd.to_numeric(df[kp_column], errors="coerce")
        return (kp >= zone.kp_start) & (kp <= zone.kp_end)

    if zone.zone_type == "event_match" and zone.event_value:
        # Use column_mappings to find the event_listing column
        event_col = None
        if column_mappings:
            for m in column_mappings:
                if m.get("mappedType") == "event_listing" and not m.get("ignored"):
                    event_col = m.get("mappedType")
                    break

        # Fallback: search for event-like column names
        if not event_col:
            for col in df.columns:
                if "event" in col.lower():
                    event_col = col
                    break

        if event_col and event_col in df.columns:
            return df[event_col].astype(str).str.lower().str.contains(
                zone.event_value.lower(), na=False
            )

        return pd.Series([False] * len(df), index=df.index)

    return pd.Series([False] * len(df), index=df.index)


def _modify_config(base_config: dict, modifiers: dict[str, float]) -> dict:
    """Apply multiplier modifiers to a flat config dict.

    Modifier keys match config keys (e.g., "dob_max", "zscore_threshold").
    Values are multipliers: 1.2 = relax by 20%, 0.8 = tighten by 20%.
    """
    modified = dict(base_config)
    for key, multiplier in modifiers.items():
        if key in modified and isinstance(modified[key], (int, float)):
            modified[key] = modified[key] * multiplier
    return modified
