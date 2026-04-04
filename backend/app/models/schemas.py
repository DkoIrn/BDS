from pydantic import BaseModel, model_validator


class ColumnMappingSchema(BaseModel):
    index: int
    originalName: str
    mappedType: str | None = None
    ignored: bool = False


class RangeThreshold(BaseModel):
    min: float
    max: float

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


class ProfileConfig(BaseModel):
    ranges: dict[str, RangeThreshold] = {}
    zscore_threshold: float = 3.0
    iqr_multiplier: float = 1.5
    kp_gap_max: float | None = None
    duplicate_kp_tolerance: float = 0.001
    monotonicity_check: bool = True
    enabled_checks: EnabledChecks = EnabledChecks()

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.zscore_threshold < 0:
            raise ValueError(f"zscore_threshold must be >= 0, got {self.zscore_threshold}")
        if self.iqr_multiplier < 0:
            raise ValueError(f"iqr_multiplier must be >= 0, got {self.iqr_multiplier}")
        return self


class ValidateRequest(BaseModel):
    dataset_id: str
    config: ProfileConfig | None = None


class ValidateResponse(BaseModel):
    run_id: str
    total_issues: int
    critical_count: int
    warning_count: int
    info_count: int
    pass_rate: float
    status: str
