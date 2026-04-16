"""Tests for custom rule execution engine."""

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

from app.models.schemas import Condition, ConditionGroup, CustomRuleDefinition
from app.services.custom_rules import evaluate_condition, evaluate_group, execute_custom_rule


@pytest.fixture
def rule_df() -> pd.DataFrame:
    """Small DataFrame for rule testing."""
    return pd.DataFrame({
        "temperature": [95.0, 105.0, 110.0, 80.0, 150.0],
        "pressure": [90.0, 100.0, 95.0, 85.0, 140.0],
        "kp": [0.0, 0.01, 0.02, 0.03, 0.04],
        "status": ["ok", "", "ok", None, "ok"],
    })


# --- Threshold rule tests ---

class TestThresholdRule:
    def test_threshold_gt_flags_rows_exceeding_value(self, rule_df):
        cond = Condition(column="temperature", rule_type="threshold", operator=">", value=100)
        mask = evaluate_condition(rule_df, cond)
        # rows 1 (105), 2 (110), 4 (150) exceed 100
        assert mask.tolist() == [False, True, True, False, True]

    def test_threshold_lt_flags_rows_below_value(self, rule_df):
        cond = Condition(column="temperature", rule_type="threshold", operator="<", value=100)
        mask = evaluate_condition(rule_df, cond)
        assert mask.tolist() == [True, False, False, True, False]

    def test_threshold_gte(self, rule_df):
        cond = Condition(column="temperature", rule_type="threshold", operator=">=", value=110)
        mask = evaluate_condition(rule_df, cond)
        assert mask.tolist() == [False, False, True, False, True]

    def test_threshold_eq(self, rule_df):
        cond = Condition(column="temperature", rule_type="threshold", operator="==", value=105)
        mask = evaluate_condition(rule_df, cond)
        assert mask.tolist() == [False, True, False, False, False]


# --- Comparison rule tests ---

class TestComparisonRule:
    def test_comparison_gt_flags_rows_where_colA_exceeds_colB(self, rule_df):
        cond = Condition(
            column="temperature", rule_type="comparison",
            operator=">", compare_column="pressure",
        )
        mask = evaluate_condition(rule_df, cond)
        # temp > pressure: 95>90=T, 105>100=T, 110>95=T, 80>85=F, 150>140=T
        assert mask.tolist() == [True, True, True, False, True]

    def test_comparison_eq(self, rule_df):
        cond = Condition(
            column="temperature", rule_type="comparison",
            operator="==", compare_column="pressure",
        )
        mask = evaluate_condition(rule_df, cond)
        assert mask.tolist() == [False, False, False, False, False]


# --- Null check rule tests ---

class TestNullCheckRule:
    def test_null_check_flags_missing_and_empty(self, rule_df):
        cond = Condition(column="status", rule_type="null_check", operator="is_null")
        mask = evaluate_condition(rule_df, cond)
        # row 1 ("") and row 3 (None) are null/empty
        assert mask.tolist() == [False, True, False, True, False]

    def test_null_check_not_null(self, rule_df):
        cond = Condition(column="status", rule_type="null_check", operator="not_null")
        mask = evaluate_condition(rule_df, cond)
        assert mask.tolist() == [True, False, True, False, True]


# --- Group logic tests ---

class TestGroupLogic:
    def test_and_group_flags_rows_matching_both(self, rule_df):
        group = ConditionGroup(
            logic="AND",
            conditions=[
                Condition(column="temperature", rule_type="threshold", operator=">", value=100),
                Condition(column="pressure", rule_type="threshold", operator=">", value=100),
            ],
        )
        mask = evaluate_group(rule_df, group)
        # temp>100 AND press>100: only row 4 (150, 140)
        assert mask.tolist() == [False, False, False, False, True]

    def test_or_group_flags_rows_matching_either(self, rule_df):
        group = ConditionGroup(
            logic="OR",
            conditions=[
                Condition(column="temperature", rule_type="threshold", operator="==", value=80),
                Condition(column="temperature", rule_type="threshold", operator="==", value=150),
            ],
        )
        mask = evaluate_group(rule_df, group)
        assert mask.tolist() == [False, False, False, True, True]

    def test_nested_group_depth_2(self, rule_df):
        """Nested group (depth 2) evaluates correctly."""
        inner_group = ConditionGroup(
            logic="AND",
            conditions=[
                Condition(column="temperature", rule_type="threshold", operator=">", value=100),
                Condition(column="pressure", rule_type="threshold", operator=">", value=90),
            ],
        )
        outer_group = ConditionGroup(
            logic="OR",
            conditions=[
                Condition(column="temperature", rule_type="threshold", operator="==", value=80),
            ],
            groups=[inner_group],
        )
        mask = evaluate_group(rule_df, outer_group)
        # temp==80 (row3) OR (temp>100 AND press>90): rows 1(105,100), 2(110,95), 4(150,140)
        assert mask.tolist() == [False, True, True, True, True]

    def test_empty_group_returns_no_matches(self, rule_df):
        group = ConditionGroup(logic="AND", conditions=[], groups=[])
        mask = evaluate_group(rule_df, group)
        assert mask.sum() == 0


# --- Edge cases ---

class TestEdgeCases:
    def test_missing_column_returns_no_matches(self, rule_df):
        cond = Condition(column="nonexistent", rule_type="threshold", operator=">", value=100)
        mask = evaluate_condition(rule_df, cond)
        assert mask.sum() == 0

    def test_nesting_depth_exceeds_2_raises_validation_error(self):
        """Nesting depth > 2 raises ValidationError."""
        deep_group = ConditionGroup(
            logic="AND",
            conditions=[Condition(column="x", rule_type="threshold", operator=">", value=1)],
            groups=[
                ConditionGroup(
                    logic="OR",
                    groups=[
                        ConditionGroup(
                            logic="AND",
                            conditions=[Condition(column="x", rule_type="threshold", operator=">", value=1)],
                        )
                    ],
                )
            ],
        )
        with pytest.raises(ValidationError):
            CustomRuleDefinition(
                name="Too deep",
                root_group=deep_group,
            )

    def test_nesting_depth_2_is_valid(self):
        """Depth 2 should be allowed."""
        group = ConditionGroup(
            logic="AND",
            groups=[
                ConditionGroup(
                    logic="OR",
                    conditions=[Condition(column="x", rule_type="threshold", operator=">", value=1)],
                )
            ],
        )
        rule = CustomRuleDefinition(name="OK depth", root_group=group)
        assert rule.name == "OK depth"


# --- execute_custom_rule integration ---

class TestExecuteCustomRule:
    def test_produces_validation_issue_dicts(self, rule_df):
        rule = CustomRuleDefinition(
            name="High temperature",
            severity="critical",
            root_group=ConditionGroup(
                logic="AND",
                conditions=[
                    Condition(column="temperature", rule_type="threshold", operator=">", value=100),
                ],
            ),
        )
        issues = execute_custom_rule(rule_df, rule, kp_column="kp")
        assert len(issues) == 3  # rows 1, 2, 4

        issue = issues[0]
        assert issue.rule_type == "custom_rule"
        assert issue.severity.value == "critical"
        assert "High temperature" in issue.message
        assert issue.kp_value is not None

    def test_issues_without_kp_column(self, rule_df):
        rule = CustomRuleDefinition(
            name="Check pressure",
            root_group=ConditionGroup(
                logic="AND",
                conditions=[
                    Condition(column="pressure", rule_type="threshold", operator=">", value=100),
                ],
            ),
        )
        issues = execute_custom_rule(rule_df, rule)
        assert len(issues) == 1  # row 4 (140)
        assert issues[0].kp_value is None
