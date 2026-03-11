from pydantic import BaseModel


class ColumnMappingSchema(BaseModel):
    index: int
    originalName: str
    mappedType: str | None = None
    ignored: bool = False


class ValidateRequest(BaseModel):
    dataset_id: str


class ValidateResponse(BaseModel):
    run_id: str
    total_issues: int
    critical_count: int
    warning_count: int
    info_count: int
    pass_rate: float
    status: str
