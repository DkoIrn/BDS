"""Custom rule execution engine.

Evaluates JSON-defined rules against pandas DataFrames, producing
standard ValidationIssue objects compatible with the validation pipeline.
"""

import logging
import operator as op

import pandas as pd

from app.models.schemas import Condition, ConditionGroup, CustomRuleDefinition
from app.validators.base import Severity, ValidationIssue

logger = logging.getLogger(__name__)

# Map operator strings to callables
OPERATORS = {
    ">": op.gt,
    ">=": op.ge,
    "<": op.lt,
    "<=": op.le,
    "==": op.eq,
    "!=": op.ne,
}


def evaluate_condition(df: pd.DataFrame, cond: Condition) -> pd.Series:
    """Evaluate a single condition against a DataFrame.

    Returns a boolean Series (True = row matches / is flagged).
    Returns all-False if column is missing (fail-safe).
    """
    n = len(df)

    if cond.rule_type == "null_check":
        if cond.column not in df.columns:
            return pd.Series([False] * n, index=df.index)
        is_na = df[cond.column].isna()
        is_empty = df[cond.column].astype(str).str.strip() == ""
        null_mask = is_na | is_empty
        if cond.operator == "not_null":
            return ~null_mask
        return null_mask  # default: is_null

    if cond.rule_type == "threshold":
        if cond.column not in df.columns:
            return pd.Series([False] * n, index=df.index)
        col_vals = pd.to_numeric(df[cond.column], errors="coerce")
        func = OPERATORS.get(cond.operator)
        if func is None:
            logger.warning("Unknown operator '%s' in threshold condition", cond.operator)
            return pd.Series([False] * n, index=df.index)
        return func(col_vals, cond.value).fillna(False)

    if cond.rule_type == "comparison":
        if cond.column not in df.columns or cond.compare_column not in df.columns:
            return pd.Series([False] * n, index=df.index)
        col_a = pd.to_numeric(df[cond.column], errors="coerce")
        col_b = pd.to_numeric(df[cond.compare_column], errors="coerce")
        func = OPERATORS.get(cond.operator)
        if func is None:
            logger.warning("Unknown operator '%s' in comparison condition", cond.operator)
            return pd.Series([False] * n, index=df.index)
        return func(col_a, col_b).fillna(False)

    # Unknown rule type -- fail safe
    return pd.Series([False] * n, index=df.index)


def evaluate_group(df: pd.DataFrame, group: ConditionGroup) -> pd.Series:
    """Evaluate a condition group (with AND/OR logic) against a DataFrame.

    Recursively evaluates sub-groups. Returns boolean Series.
    Returns all-False for empty groups (fail-safe).
    """
    n = len(df)
    masks: list[pd.Series] = []

    for cond in group.conditions:
        masks.append(evaluate_condition(df, cond))

    for sub_group in group.groups:
        masks.append(evaluate_group(df, sub_group))

    if not masks:
        return pd.Series([False] * n, index=df.index)

    if group.logic == "AND":
        combined = masks[0]
        for m in masks[1:]:
            combined = combined & m
        return combined
    else:  # OR
        combined = masks[0]
        for m in masks[1:]:
            combined = combined | m
        return combined


def execute_custom_rule(
    df: pd.DataFrame,
    rule: CustomRuleDefinition,
    kp_column: str | None = None,
) -> list[ValidationIssue]:
    """Execute a custom rule definition against a DataFrame.

    Returns a list of ValidationIssue objects for flagged rows,
    compatible with the standard validation pipeline output.
    """
    mask = evaluate_group(df, rule.root_group)
    flagged_indices = df.index[mask]

    severity_map = {
        "critical": Severity.CRITICAL,
        "warning": Severity.WARNING,
        "info": Severity.INFO,
    }
    severity = severity_map.get(rule.severity, Severity.WARNING)

    issues: list[ValidationIssue] = []
    for idx in flagged_indices:
        row_number = int(idx) + 1  # 1-based row numbers

        kp_value = None
        if kp_column and kp_column in df.columns:
            raw_kp = df.at[idx, kp_column]
            try:
                kp_value = float(raw_kp)
            except (ValueError, TypeError):
                kp_value = None

        # Determine the primary column from the first condition
        column_name = ""
        if rule.root_group.conditions:
            column_name = rule.root_group.conditions[0].column

        issues.append(ValidationIssue(
            row_number=row_number,
            column_name=column_name,
            rule_type="custom_rule",
            severity=severity,
            message=f"Custom rule '{rule.name}' triggered",
            expected=None,
            actual=None,
            kp_value=kp_value,
        ))

    return issues
