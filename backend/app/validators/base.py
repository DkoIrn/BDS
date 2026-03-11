from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol

import pandas as pd


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    row_number: int
    column_name: str
    rule_type: str
    severity: Severity
    message: str
    expected: str | None = None
    actual: str | None = None
    kp_value: float | None = None


class Validator(Protocol):
    def validate(
        self,
        df: pd.DataFrame,
        column_mappings: list[dict],
        config: dict,
    ) -> list[ValidationIssue]: ...
