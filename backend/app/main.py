import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send
from app.core.config import settings
from app.core.database import engine, init_db
from app.core.errors import install_error_handler
from app.core.i18n import parse_accept_language, set_locale, tr
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


#: Ceiling on a single request body (~56 MB covers the 40 MB attachment budget plus base64/JSON overhead).
MAX_REQUEST_BODY_BYTES = 56 * 1024 * 1024


class MaxBodySizeMiddleware:
    """Reject oversized request bodies before they are read into memory."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_length = Headers(scope=scope).get("content-length")
        if raw_length:
            try:
                length = int(raw_length)
            except ValueError:
                length = 0
            if length > self.max_bytes:
                await JSONResponse(
                    {
                        "detail": tr(
                            "REQUEST_BODY_TOO_LARGE",
                            size=length // (1024 * 1024),
                            limit=self.max_bytes // (1024 * 1024),
                        ),
                        "code": "REQUEST_BODY_TOO_LARGE",
                    },
                    status_code=413,
                )(scope, receive, send)
                return

        await self.app(scope, receive, send)


class LocaleMiddleware:
    """把请求的语言解析进 ContextVar，供服务层 tr() 读取。"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        set_locale(parse_accept_language(Headers(scope=scope).get("accept-language")))
        await self.app(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema and pgvector extension...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception:
        logger.critical(
            "Database initialization failed; refusing to start. "
            "If Postgres is healthy, the cause is most likely a missing pgvector "
            "extension or insufficient privileges for CREATE EXTENSION.",
            exc_info=True,
        )
        raise

    async def _startup_sync_models():
        try:
            from app.services.catalog import sync_chat_models
            from app.services.image_gen import image_gen_service
            from app.services.video_gen import video_gen_service
            from app.services.speech.service import speech_service

            logger.info("Initializing models catalog from configured provider APIs on startup...")
            await sync_chat_models()
            if image_gen_service.active_providers():
                await image_gen_service.sync_models()
            if video_gen_service.active_providers():
                await video_gen_service.sync_models()
            if speech_service.active_providers():
                await speech_service.sync_models()
            logger.info("Startup model sync completed successfully.")
        except Exception as e:
            logger.warning("Startup model sync skipped or failed: %s", e)

    await _startup_sync_models()

    yield
    logger.info("Shutting down Apiapia assistant backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.APP_VERSION,
    description="Apiapia Assistant API: multi-model routing with Mem0 OSS long-term memory",
    lifespan=lifespan
)
install_error_handler(app)

# Middleware execution order: CORS -> Locale -> MaxBodySize
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
app.add_middleware(LocaleMiddleware)

# CORS Middleware: 兼容通配符与带凭证场景
raw_cors = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
has_wildcard = "*" in raw_cors
cors_origins = [o for o in raw_cors if o != "*"]
allow_origin_regex = (
    settings.CORS_ORIGIN_REGEX.strip()
    if settings.CORS_ORIGIN_REGEX and settings.CORS_ORIGIN_REGEX.strip()
    else (".*" if has_wildcard else None)
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
    allow_origins=cors_origins if not has_wildcard else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": app.version,
        "status": "online",
        "mem0_version": settings.MEM0_VERSION
    }


async def _probe_database() -> tuple:
    """Probe Postgres connectivity; returns (ok, detail)."""
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, "connected"
    except Exception as e:
        logger.warning("Health probe: database unreachable (%s)", type(e).__name__)
        return False, f"unavailable ({type(e).__name__})"


@app.get(f"{settings.API_V1_STR}/health", tags=["health"])
async def health_check():
    """Liveness/readiness check for container health."""
    from app.services.memory.service import memory_service
    from app.services.speech.service import speech_service

    db_ok, db_detail = await _probe_database()
    memory_ready = memory_service.is_configured()

    if not speech_service.is_configured():
        speech_status = "no OpenRouter key"
    else:
        catalog = speech_service.load_stored_models()
        if not catalog:
            speech_status = "catalog not synced"
        else:
            stt_n = sum(1 for m in catalog if m.get("capability") == "stt")
            tts_n = sum(1 for m in catalog if m.get("capability") == "tts")
            speech_status = f"{stt_n} stt / {tts_n} tts catalogued"

    payload = {
        "status": "healthy" if db_ok else "degraded",
        "database": db_detail,
        "vector_store": "pgvector",
        "mem0_oss": f"{settings.MEM0_VERSION} ({'ready' if memory_ready else 'no LLM key'})",
        "web_search": (
            "tavily+duckduckgo"
            if (settings.TAVILY_API_KEY and settings.TAVILY_API_KEY.strip())
            else "duckduckgo"
        ),
        "speech": speech_status,
        "version": app.version,
    }

    if not db_ok:
        return JSONResponse(status_code=503, content=payload)
    return payload


app.include_router(api_router, prefix=settings.API_V1_STR)
