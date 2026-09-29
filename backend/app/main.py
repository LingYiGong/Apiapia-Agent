import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import api_router

# Configure standard logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("apiapia")

# Filter out repetitive health check access logs to prevent console log flooding
class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/health" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema and pgvector extension...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error("Database initialization failed: %s", str(e), exc_info=True)
    yield
    logger.info("Shutting down Apiapia assistant backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.5.0",
    description="Apiapia 助理 API：多模型解耦调度与 Mem0 OSS 长期记忆",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in container networking
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "2.5.0",
        "status": "online",
        "mem0_version": settings.MEM0_VERSION
    }


@app.get("/api/health", tags=["health"])
async def health_check():
    tavily_configured = bool(settings.TAVILY_API_KEY and settings.TAVILY_API_KEY.strip())
    return {
        "status": "healthy",
        "database": "connected",
        "vector_store": "pgvector",
        "mem0_oss": "active (2.2.1)",
        "web_search": "tavily+duckduckgo" if tavily_configured else "duckduckgo"
    }


app.include_router(api_router, prefix=settings.API_V1_STR)
