from fastapi import APIRouter, HTTPException

from app.models.schemas import ValidateRequest, ValidateResponse

router = APIRouter(prefix="/api/v1", tags=["validation"])


@router.post("/validate", response_model=ValidateResponse)
def validate_dataset(request: ValidateRequest):
    """Run validation checks on a dataset."""
    raise HTTPException(status_code=501, detail="Not implemented")
