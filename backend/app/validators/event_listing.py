"""Event listing QC checks — survey-specific validation.

Validates event listing datasets for common data quality issues:
duplicate events at the same KP, missing event codes/descriptions,
and event ordering relative to KP progression.
"""

import pandas as pd
from app.validators.base import ValidationIssue, Severity


def _find_column_by_type(
    column_mappings: list[dict], col_type: str
) -> str | None:
    """Find the original column name for a mapped type."""
    for m in column_mappings:
        if m.get("mappedType") == col_type and not m.get("ignored", False):
            return m.get("originalName", col_type)
    return None


def _get_kp(df: pd.DataFrame, idx: int, kp_column: str | None) -> float | None:
    if kp_column and kp_column in df.columns:
        try:
            return float(df.iloc[idx][kp_column])
        except (ValueError, TypeError, IndexError):
            return None
    return None


def check_event_listing(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Run all event listing checks.

    Checks:
    1. Missing event codes — rows with no event type
    2. Missing event descriptions — event code present but no description
    3. Duplicate events at same KP — same event type at the same location
    4. Event KP ordering — events should follow KP progression
    """
    issues: list[ValidationIssue] = []

    event_col = _find_column_by_type(column_mappings, "event")
    desc_col = _find_column_by_type(column_mappings, "description")

    if not event_col or event_col not in df.columns:
        return issues

    # 1. Missing event codes
    for idx in range(len(df)):
        val = df.iloc[idx].get(event_col)
        if pd.isna(val) or str(val).strip() == "":
            kp_val = _get_kp(df, idx, kp_column)
            issues.append(ValidationIssue(
                row_number=idx + 2,
                column_name=event_col,
                rule_type="missing_event_code",
                severity=Severity.WARNING,
                message="Missing event code — row has no event type assigned",
                expected="Non-empty event code",
                actual="Empty",
                kp_value=kp_val,
            ))

    # 2. Missing event descriptions
    if desc_col and desc_col in df.columns:
        for idx in range(len(df)):
            event_val = df.iloc[idx].get(event_col)
            desc_val = df.iloc[idx].get(desc_col)

            has_event = not (pd.isna(event_val) or str(event_val).strip() == "")
            has_desc = not (pd.isna(desc_val) or str(desc_val).strip() == "")

            if has_event and not has_desc:
                kp_val = _get_kp(df, idx, kp_column)
                issues.append(ValidationIssue(
                    row_number=idx + 2,
                    column_name=desc_col,
                    rule_type="missing_event_description",
                    severity=Severity.INFO,
                    message=f"Event '{event_val}' has no description",
                    expected="Non-empty description for event",
                    actual="Empty",
                    kp_value=kp_val,
                ))

    # 3. Duplicate events at same KP
    if kp_column and kp_column in df.columns:
        seen: dict[tuple, int] = {}  # (kp_rounded, event_code) -> first row idx
        for idx in range(len(df)):
            event_val = df.iloc[idx].get(event_col)
            if pd.isna(event_val) or str(event_val).strip() == "":
                continue

            try:
                kp_val = float(df.iloc[idx][kp_column])
            except (ValueError, TypeError):
                continue

            key = (round(kp_val, 3), str(event_val).strip().upper())
            if key in seen:
                first_row = seen[key]
                issues.append(ValidationIssue(
                    row_number=idx + 2,
                    column_name=event_col,
                    rule_type="duplicate_event",
                    severity=Severity.WARNING,
                    message=(
                        f"Duplicate event '{event_val}' at KP {kp_val:.3f} "
                        f"— first occurrence at row {first_row + 2}"
                    ),
                    expected="Unique event per KP location",
                    actual=f"Duplicate of row {first_row + 2}",
                    kp_value=kp_val,
                ))
            else:
                seen[key] = idx

    # 4. Event KP ordering — check events appear in KP sequence
    if kp_column and kp_column in df.columns:
        prev_kp: float | None = None
        for idx in range(len(df)):
            event_val = df.iloc[idx].get(event_col)
            if pd.isna(event_val) or str(event_val).strip() == "":
                continue

            try:
                kp_val = float(df.iloc[idx][kp_column])
            except (ValueError, TypeError):
                continue

            if prev_kp is not None and kp_val < prev_kp:
                issues.append(ValidationIssue(
                    row_number=idx + 2,
                    column_name=f"{kp_column}/{event_col}",
                    rule_type="event_kp_order",
                    severity=Severity.WARNING,
                    message=(
                        f"Event '{event_val}' at KP {kp_val:.3f} appears after "
                        f"KP {prev_kp:.3f} — events not in KP order"
                    ),
                    expected=f"KP ≥ {prev_kp:.3f}",
                    actual=f"KP {kp_val:.3f}",
                    kp_value=kp_val,
                ))

            prev_kp = kp_val

    return issues
