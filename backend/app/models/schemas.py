from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, model_validator


class ColumnMappingSchema(BaseModel):
    index: int
    originalName: str
    mappedType: str | None = None
    ignored: bool = False


class RangeThreshold(BaseModel):
    min: float
    max: float
    tolerance: float = 0.0

    @model_validator(mode="after")
    def min_must_not_exceed_max(self):
        if self.min > self.max:
            raise ValueError(f"min ({self.min}) must not be greater than max ({self.max})")
        return self


class EnabledChecks(BaseModel):
    range_check: bool = True
    missing_data: bool = True
    duplicate_rows: bool = True
    near_duplicate_kp: bool = True
    outliers_zscore: bool = True
    outliers_iqr: bool = True
    kp_gaps: bool = True
    monotonicity: bool = True
    cross_column: bool = True
    spike_detection: bool = True
    coordinate_sanity: bool = True
    event_listing: bool = True
    position_consistency: bool = True
    kp_drift: bool = True
    segment_continuity: bool = True


class ProfileConfig(BaseModel):
    ranges: dict[str, RangeThreshold] = {}
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    kp_gap_max: float | None = None
    duplicate_kp_tolerance: float = 0.001
    monotonicity_check: bool = True
    kp_drift_tolerance: float = 0.01
    max_segment_distance: float = 100.0
    kp_drift_severity: str = "warning"
    segment_continuity_severity: str = "warning"
    enabled_checks: EnabledChecks = EnabledChecks()

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.zscore_threshold < 0:
            raise ValueError(f"zscore_threshold must be >= 0, got {self.zscore_threshold}")
        if self.iqr_multiplier < 0:
            raise ValueError(f"iqr_multiplier must be >= 0, got {self.iqr_multiplier}")
        return self


class CrossDatasetConfig(BaseModel):
    preset_id: str | None = None
    dataset_type_a: str = ""
    dataset_type_b: str = ""
    column_mapping: list[dict] | None = None  # manual overrides
    tolerances: dict[str, float] | None = None  # user tolerance overrides


class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None
    secondary_dataset_id: str | None = None
    cross_dataset_config: CrossDatasetConfig | None = None
    custom_rule_ids: list[str] | None = None


class ValidateResponse(BaseModel):
    run_id: str
    total_issues: int
    critical_count: int
    warning_count: int
    info_count: int
    pass_rate: float
    status: str


# --- Custom rule models ---


class Condition(BaseModel):
    column: str
    rule_type: Literal["threshold", "comparison", "null_check"]
    operator: str
    value: float | str | None = None
    compare_column: str | None = None


class ConditionGroup(BaseModel):
    logic: Literal["AND", "OR"] = "AND"
    conditions: list[Condition] = []
    groups: list[ConditionGroup] = []


def _check_nesting_depth(group: ConditionGroup, current_depth: int = 0) -> int:
    """Return max nesting depth from this group downward."""
    if not group.groups:
        return current_depth
    return max(
        _check_nesting_depth(g, current_depth + 1) for g in group.groups
    )


class CustomRuleDefinition(BaseModel):
    name: str
    description: str = ""
    severity: Literal["critical", "warning", "info"] = "warning"
    root_group: ConditionGroup

    @model_validator(mode="after")
    def validate_nesting_depth(self):
        depth = _check_nesting_depth(self.root_group)
        if depth > 2:
            raise ValueError(
                f"Rule nesting depth {depth} exceeds maximum of 2 levels"
            )
        return self
