import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.queue import USE_JOB_QUEUE
from app.queue import app as procrastinate_app
from app.routers.parsing import router as parsing_router
from app.routers.reports import router as reports_router
from app.routers.validation import router as validation_router
from app.routers.conversion import router as conversion_router
from app.routers.transform import router as transform_router
from app.routers.compare import router as compare_router
from app.routers.jobs import router as jobs_router
from app.routers.versions import router as versions_router
from app.routers.certificates import router as certificates_router
from app.routers.validate_file import router as validate_file_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    """Application lifespan: opens procrastinate connection pool on startup."""
    if USE_JOB_QUEUE:
        async with procrastinate_app.open_async():
            logger.info("Procrastinate app opened (job queue enabled)")
            yield
        logger.info("Procrastinate app closed")
    else:
        logger.info("Job queue disabled (USE_JOB_QUEUE=false), using legacy BackgroundTasks")
        yield


app = FastAPI(
    title="SurveyQC Validation API",
    description="AI Data QA & Validation Platform for pipeline/seabed survey data",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(conversion_router)
app.include_router(transform_router)
app.include_router(compare_router)
app.include_router(jobs_router)
app.include_router(versions_router, tags=["versions"])
app.include_router(certificates_router, tags=["certificates"])
app.include_router(validate_file_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
