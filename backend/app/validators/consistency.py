"""Cross-column consistency checks — engineering-grade validation.

These replicate what senior QC engineers check manually:
physical plausibility, inter-column relationships, and logical constraints.
"""

import pandas as pd
from app.validators.base import ValidationIssue, Severity


# Cross-column rules: (col_a, col_b, relationship, message_template)
# Each rule defines a physical constraint between two survey columns.
CONSISTENCY_RULES = [
    {
        "a": "dob",
        "b": "depth",
        "check": "a_lte_b",
        "message": "DOB ({a_val}m) exceeds water depth ({b_val}m) — physically inconsistent",
        "severity": Severity.CRITICAL,
    },
    {
        "a": "doc",
        "b": "depth",
        "check": "a_lte_b",
        "message": "DOC ({a_val}m) exceeds water depth ({b_val}m) — physically inconsistent",
        "severity": Severity.CRITICAL,
    },
    {
        "a": "doc",
        "b": "dob",
        "check": "a_lte_b",
        "message": "DOC ({a_val}m) exceeds DOB ({b_val}m) — cover cannot exceed burial depth",
        "severity": Severity.WARNING,
    },
    {
        "a": "top",
        "b": "depth",
        "check": "a_lte_b",
        "message": "TOP ({a_val}m) exceeds water depth ({b_val}m) — pipe above seabed level",
        "severity": Severity.WARNING,
    },
    {
        "a": "dob",
        "b": "top",
        "check": "a_gte_b_when_both_positive",
        "message": "DOB ({a_val}m) is less than TOP ({b_val}m) — burial should be deeper than pipe top",
        "severity": Severity.WARNING,
    },
]


def _get_kp_value(row: pd.Series, kp_column: str | None) -> float | None:
    if kp_column and kp_column in row.index:
        val = row[kp_column]
        try:
            return float(val)
        except (ValueError, TypeError):
            return None
    return None


def check_cross_column_consistency(
    df: pd.DataFrame,
    column_mappings: list[dict],
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Check physical consistency between related columns.

    Returns issues where cross-column relationships are violated,
    indicating physically implausible data.
    """
    issues: list[ValidationIssue] = []

    # Build mapping from type -> column name
    type_to_col: dict[str, str] = {}
    for m in column_mappings:
        mapped_type = m.get("mappedType")
        if mapped_type and not m.get("ignored", False):
            type_to_col[mapped_type] = mapped_type  # column already renamed

    for rule in CONSISTENCY_RULES:
        col_a_type = rule["a"]
        col_b_type = rule["b"]

        # Both columns must exist
        if col_a_type not in type_to_col or col_b_type not in type_to_col:
            continue

        col_a = type_to_col[col_a_type]
        col_b = type_to_col[col_b_type]

        if col_a not in df.columns or col_b not in df.columns:
            continue

        for idx, row in df.iterrows():
            try:
                val_a = float(row[col_a])
                val_b = float(row[col_b])
            except (ValueError, TypeError):
                continue

            if pd.isna(val_a) or pd.isna(val_b):
                continue

            violated = False
            check = rule["check"]

            if check == "a_lte_b":
                violated = val_a > val_b
            elif check == "a_gte_b_when_both_positive":
                if val_a > 0 and val_b > 0:
                    violated = val_a < val_b

            if violated:
                kp_val = _get_kp_value(row, kp_column)
                msg = rule["message"].format(
                    a_val=round(val_a, 3),
                    b_val=round(val_b, 3),
                )
                issues.append(ValidationIssue(
                    row_number=int(idx) + 2,  # 1-indexed + header
                    column_name=f"{col_a_type}/{col_b_type}",
                    rule_type="cross_column_consistency",
                    severity=rule["severity"],
                    message=msg,
                    expected=f"{col_a_type} ≤ {col_b_type}" if check == "a_lte_b" else f"{col_a_type} ≥ {col_b_type}",
                    actual=f"{col_a_type}={round(val_a, 3)}, {col_b_type}={round(val_b, 3)}",
                    kp_value=kp_val,
                ))

    return issues
