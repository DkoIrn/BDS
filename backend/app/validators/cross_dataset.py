"""Cross-dataset validation: compare two related survey DataFrames using KP-based alignment.

Produces ValidationIssue records with rule_type="cross_dataset", row_number=0,
and populated kp_value for meaningful KP-based references.
"""

import pandas as pd

from app.validators.base import ValidationIssue, Severity
from app.services.cross_validation_presets import CrossValidationPreset


def align_by_kp(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    kp_col_a: str,
    kp_col_b: str,
    tolerance: float = 0.01,
) -> pd.DataFrame:
    """Align two DataFrames by nearest KP value using merge_asof.

    Returns merged DataFrame with suffixes _a and _b for overlapping columns.
    Rows from df_a that have no match within tolerance get NaN for _b columns.
    """
    a = df_a.sort_values(kp_col_a).reset_index(drop=True).copy()
    b = df_b.sort_values(kp_col_b).reset_index(drop=True).copy()

    # Ensure KP columns are numeric
    a[kp_col_a] = pd.to_numeric(a[kp_col_a], errors="coerce")
    b[kp_col_b] = pd.to_numeric(b[kp_col_b], errors="coerce")

    merged = pd.merge_asof(
        a,
        b,
        left_on=kp_col_a,
        right_on=kp_col_b,
        tolerance=tolerance,
        direction="nearest",
        suffixes=("_a", "_b"),
    )
    return merged


def check_value_delta(
    merged: pd.DataFrame,
    col_a: str,
    col_b: str,
    tolerance: float,
    preset: CrossValidationPreset,
) -> list[ValidationIssue]:
    """Flag rows where abs(col_a - col_b) > tolerance."""
    issues: list[ValidationIssue] = []

    if col_a not in merged.columns or col_b not in merged.columns:
        return issues

    for _, row in merged.iterrows():
        try:
            val_a = float(row[col_a])
            val_b = float(row[col_b])
        except (ValueError, TypeError):
            continue

        if pd.isna(val_a) or pd.isna(val_b):
            continue

        delta = abs(val_a - val_b)
        if delta > tolerance:
            # Extract base column names (remove _a/_b suffix for display)
            base_a = col_a.rstrip("_a").rstrip("_") if col_a.endswith("_a") else col_a
            base_b = col_b.rstrip("_b").rstrip("_") if col_b.endswith("_b") else col_b

            kp_val = _extract_kp(row, merged)

            issues.append(ValidationIssue(
                row_number=0,
                column_name=f"{base_a}({preset.dataset_a_type})/{base_b}({preset.dataset_b_type})",
                rule_type="cross_dataset",
                severity=Severity.WARNING,
                message=(
                    f"{base_a} vs {base_b} mismatch at KP {kp_val:.3f}: "
                    f"{base_a}={val_a:.3f} ({preset.dataset_a_type}) vs "
                    f"{base_b}={val_b:.3f} ({preset.dataset_b_type}) "
                    f"-- delta {delta:.3f} exceeds tolerance {tolerance}"
                ),
                expected=f"delta <= {tolerance}",
                actual=f"{base_a}={val_a:.3f}, {base_b}={val_b:.3f}, delta={delta:.3f}",
                kp_value=kp_val,
            ))

    return issues


def check_relationship(
    merged: pd.DataFrame,
    col_a: str,
    col_b: str,
    op: str,
    tolerance: float,
    preset: CrossValidationPreset,
) -> list[ValidationIssue]:
    """Check relationship between two columns (e.g., a_gte_b: col_a >= col_b)."""
    issues: list[ValidationIssue] = []

    if col_a not in merged.columns or col_b not in merged.columns:
        return issues

    for _, row in merged.iterrows():
        try:
            val_a = float(row[col_a])
            val_b = float(row[col_b])
        except (ValueError, TypeError):
            continue

        if pd.isna(val_a) or pd.isna(val_b):
            continue

        violated = False
        if op == "a_gte_b":
            violated = val_a < val_b - tolerance

        if violated:
            kp_val = _extract_kp(row, merged)
            delta = val_b - val_a

            issues.append(ValidationIssue(
                row_number=0,
                column_name=f"{col_a}({preset.dataset_a_type})/{col_b}({preset.dataset_b_type})",
                rule_type="cross_dataset",
                severity=Severity.CRITICAL,
                message=(
                    f"{col_a} vs {col_b} violation at KP {kp_val:.3f}: "
                    f"{col_a}={val_a:.3f} ({preset.dataset_a_type}) vs "
                    f"{col_b}={val_b:.3f} ({preset.dataset_b_type}) "
                    f"-- {col_b} exceeds {col_a} by {delta:.3f}"
                ),
                expected=f"{col_a} >= {col_b}",
                actual=f"{col_a}={val_a:.3f}, {col_b}={val_b:.3f}",
                kp_value=kp_val,
            ))

    return issues


def check_coverage_gaps(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    kp_col: str,
    preset: CrossValidationPreset,
) -> list[ValidationIssue]:
    """Flag KP ranges present in one dataset but not the other."""
    issues: list[ValidationIssue] = []

    kp_col_a = kp_col
    kp_col_b = kp_col

    if kp_col_a not in df_a.columns or kp_col_b not in df_b.columns:
        return issues

    min_a = pd.to_numeric(df_a[kp_col_a], errors="coerce").min()
    max_a = pd.to_numeric(df_a[kp_col_a], errors="coerce").max()
    min_b = pd.to_numeric(df_b[kp_col_b], errors="coerce").min()
    max_b = pd.to_numeric(df_b[kp_col_b], errors="coerce").max()

    if pd.isna(min_a) or pd.isna(max_a) or pd.isna(min_b) or pd.isna(max_b):
        return issues

    # Check if dataset A extends beyond dataset B
    if max_a > max_b:
        issues.append(ValidationIssue(
            row_number=0,
            column_name=f"KP({preset.dataset_a_type})/KP({preset.dataset_b_type})",
            rule_type="cross_dataset",
            severity=Severity.WARNING,
            message=(
                f"Coverage gap: {preset.dataset_a_type} extends to KP {max_a:.3f} "
                f"but {preset.dataset_b_type} only covers to KP {max_b:.3f} "
                f"-- gap from KP {max_b:.3f} to {max_a:.3f}"
            ),
            expected=f"Both datasets cover same KP range",
            actual=f"{preset.dataset_a_type}: {min_a:.3f}-{max_a:.3f}, {preset.dataset_b_type}: {min_b:.3f}-{max_b:.3f}",
            kp_value=max_b,
        ))

    if max_b > max_a:
        issues.append(ValidationIssue(
            row_number=0,
            column_name=f"KP({preset.dataset_a_type})/KP({preset.dataset_b_type})",
            rule_type="cross_dataset",
            severity=Severity.WARNING,
            message=(
                f"Coverage gap: {preset.dataset_b_type} extends to KP {max_b:.3f} "
                f"but {preset.dataset_a_type} only covers to KP {max_a:.3f} "
                f"-- gap from KP {max_a:.3f} to {max_b:.3f}"
            ),
            expected=f"Both datasets cover same KP range",
            actual=f"{preset.dataset_a_type}: {min_a:.3f}-{max_a:.3f}, {preset.dataset_b_type}: {min_b:.3f}-{max_b:.3f}",
            kp_value=max_a,
        ))

    if min_a < min_b:
        issues.append(ValidationIssue(
            row_number=0,
            column_name=f"KP({preset.dataset_a_type})/KP({preset.dataset_b_type})",
            rule_type="cross_dataset",
            severity=Severity.WARNING,
            message=(
                f"Coverage gap: {preset.dataset_a_type} starts at KP {min_a:.3f} "
                f"but {preset.dataset_b_type} starts at KP {min_b:.3f} "
                f"-- gap from KP {min_a:.3f} to {min_b:.3f}"
            ),
            expected=f"Both datasets cover same KP range",
            actual=f"{preset.dataset_a_type}: {min_a:.3f}-{max_a:.3f}, {preset.dataset_b_type}: {min_b:.3f}-{max_b:.3f}",
            kp_value=min_a,
        ))

    if min_b < min_a:
        issues.append(ValidationIssue(
            row_number=0,
            column_name=f"KP({preset.dataset_a_type})/KP({preset.dataset_b_type})",
            rule_type="cross_dataset",
            severity=Severity.WARNING,
            message=(
                f"Coverage gap: {preset.dataset_b_type} starts at KP {min_b:.3f} "
                f"but {preset.dataset_a_type} starts at KP {min_b:.3f} "
                f"-- gap from KP {min_b:.3f} to {min_a:.3f}"
            ),
            expected=f"Both datasets cover same KP range",
            actual=f"{preset.dataset_a_type}: {min_a:.3f}-{max_a:.3f}, {preset.dataset_b_type}: {min_b:.3f}-{max_b:.3f}",
            kp_value=min_b,
        ))

    return issues


def _resolve_column(
    col_type: str,
    column_mapping: list[dict],
    side: str,
) -> str | None:
    """Resolve a column type to an actual column name using manual mapping or default."""
    # Check manual mapping overrides first
    for m in column_mapping:
        if m.get("type") == col_type:
            return m.get(f"col_{side}")

    # Fall back to the type name itself (assumes columns are named by type)
    return col_type


def _find_kp_column(merged: pd.DataFrame) -> str | None:
    """Find the KP column in a merged DataFrame."""
    for candidate in ["KP", "kp", "KP_a", "kp_a"]:
        if candidate in merged.columns:
            return candidate
    return None


def _extract_kp(row: pd.Series, merged: pd.DataFrame) -> float:
    """Extract KP value from a merged row."""
    kp_col = _find_kp_column(merged)
    if kp_col:
        try:
            return float(row[kp_col])
        except (ValueError, TypeError):
            pass
    return 0.0


def run_cross_dataset_checks(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    preset: CrossValidationPreset,
    column_mapping: list[dict],
    config: dict,
) -> list[ValidationIssue]:
    """Compare two aligned DataFrames using preset-defined checks.

    Args:
        df_a: Primary dataset DataFrame
        df_b: Secondary dataset DataFrame
        preset: Cross-validation preset defining checks and tolerances
        column_mapping: Manual column mapping overrides
        config: User-adjusted tolerance overrides
    """
    issues: list[ValidationIssue] = []

    # Determine KP columns
    kp_col_a = _resolve_column("kp", column_mapping, "a") or "KP"
    kp_col_b = _resolve_column("kp", column_mapping, "b") or "KP"

    # Find actual KP column names in DataFrames
    kp_col_a = _find_actual_column(df_a, kp_col_a)
    kp_col_b = _find_actual_column(df_b, kp_col_b)

    if not kp_col_a or not kp_col_b:
        return issues

    # 1. Align by KP
    kp_tol = config.get("kp_alignment_tolerance", preset.kp_alignment_tolerance)
    merged = align_by_kp(df_a, df_b, kp_col_a, kp_col_b, tolerance=kp_tol)

    # 2. Coverage gap check
    issues.extend(check_coverage_gaps(df_a, df_b, kp_col_a, preset))

    # 3. Run each column pair check
    for pair in preset.column_pairs:
        check = pair["check"]

        if check == "coverage" or check == "event_coverage":
            continue  # Handled above

        col_a_type = pair["a"]
        col_b_type = pair["b"]

        # Resolve actual column names in the merged DataFrame
        col_a = _find_merged_column(merged, col_a_type, "_a")
        col_b = _find_merged_column(merged, col_b_type, "_b")

        if not col_a or not col_b:
            continue

        # Get tolerance: config override > pair default
        tolerance_key = f"{col_a_type}_{col_b_type}_tolerance"
        tolerance = config.get(tolerance_key, pair.get("tolerance", 0.0))

        if check == "delta":
            issues.extend(check_value_delta(merged, col_a, col_b, tolerance, preset))
        elif check == "a_gte_b":
            issues.extend(check_relationship(merged, col_a, col_b, "a_gte_b", tolerance, preset))

    return issues


def _find_actual_column(df: pd.DataFrame, col_name: str) -> str | None:
    """Find a column in a DataFrame, trying case-insensitive match."""
    if col_name in df.columns:
        return col_name
    lower_map = {c.lower(): c for c in df.columns}
    return lower_map.get(col_name.lower())


def _find_merged_column(merged: pd.DataFrame, col_type: str, suffix: str) -> str | None:
    """Find a column in a merged DataFrame, trying with and without suffix."""
    # Try exact match with suffix first (e.g., "Easting_a")
    candidates = [
        f"{col_type}{suffix}",  # e.g., "Easting_a"
        col_type,  # e.g., "DOB" (no overlap, no suffix)
    ]
    # Also try capitalized versions
    candidates.extend([
        f"{col_type.capitalize()}{suffix}",
        col_type.capitalize(),
        f"{col_type.upper()}{suffix}",
        col_type.upper(),
    ])

    for candidate in candidates:
        if candidate in merged.columns:
            return candidate

    return None
