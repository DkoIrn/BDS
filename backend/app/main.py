from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.parsing import router as parsing_router
from app.routers.reports import router as reports_router
from app.routers.validation import router as validation_router

app = FastAPI(
    title="SurveyQC Validation API",
    description="AI Data QA & Validation Platform for pipeline/seabed survey data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parsing_router)
app.include_router(reports_router)
app.include_router(validation_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
