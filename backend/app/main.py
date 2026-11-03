import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.initial_data import seed_initial_data

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        seed_initial_data()
    except SQLAlchemyError:
        logger.exception("Could not seed initial data - did you run `alembic upgrade head`?")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the browser read the filename of export / payslip downloads
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    # Foreign key / unique / check violations not caught by endpoint validation
    message = str(exc.orig).splitlines()[0] if exc.orig else "Database constraint violated"
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": message})


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"name": settings.APP_NAME, "docs": "/docs"}
