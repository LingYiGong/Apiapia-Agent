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


#: Ceiling on a single request body. A chat message carries attachments as inline
#: base64 data URLs, so one request is roughly 4/3 of the raw file bytes; 32 MB
#: leaves room for a handful of images while staying far below the point where the
#: process starts to thrash.
MAX_REQUEST_BODY_BYTES = 32 * 1024 * 1024


class MaxBodySizeMiddleware:
    """Reject oversized request bodies before they are read into memory.

    Written as raw ASGI on purpose. ``@app.middleware("http")`` builds on
    BaseHTTPMiddleware, which sits between the request and the response — and this
    application's main job is streaming a long-lived SSE response. A middleware that
    buffers or re-enters that path is a source of stalls and dropped streams, so
    this one only inspects the incoming headers and otherwise passes every message
    through untouched.

    Limitation, stated plainly: it relies on Content-Length. A chunked request with
    no declared length gets through here and is caught later by ChatRequest's
    per-attachment budget, at which point the body has already been parsed. Browsers,
    curl and every JS fetch client set Content-Length for a JSON body of this shape,
    so in practice this is the layer that does the work; the schema check is the
    backstop, not the gate.
    """

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
                    # Literal rather than status.HTTP_413_*: Starlette renamed that
                    # constant in 2024 (REQUEST_ENTITY_TOO_LARGE → CONTENT_TOO_LARGE)
                    # and kept the old name as a deprecation alias, so depending on
                    # it means this file breaks on one upgrade or the other.
                    status_code=413,
                )(scope, receive, send)
                return

        await self.app(scope, receive, send)


class LocaleMiddleware:
    """把请求的语言解析进 ContextVar，让 tr() 在服务层任意深度都能取到。

    与 MaxBodySizeMiddleware 一样写成裸 ASGI，而不是
    ``@app.middleware("http")``：后者基于 BaseHTTPMiddleware，
    本应用最核心的工作是推一条长连接 SSE 响应，包一层会引入缓冲与重入，
    正是流式卡顿和断流的常见来源。这里只读一次请求头，不碰消息体。

    语言来自标准的 ``Accept-Language`` 头，由前端每次请求显式带上
    （见 frontend/src/i18n/runtime.ts 的 acceptLanguageHeader）。
    用标准头而不是自定义头，是为了让搜索引擎、CDN 与任何未来绕过本项目
    前端的调用方都能得到同样正确的语言，而不是看到一句默认中文。
    """

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
        # Deliberately fatal. This used to log and continue, which produced the
        # worst possible failure mode: the process stayed up, every request 500'd,
        # and /api/health still answered "database: connected", so Docker never
        # restarted it. Exiting non-zero lets `restart: unless-stopped` retry,
        # which recovers from a database that is merely slow to come up, and makes
        # a genuinely broken schema fail loudly instead of mysteriously.
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

            logger.info("Auto-syncing chat models, image models, video models, and audio models from configured providers on startup...")
            await sync_chat_models()
            if image_gen_service.active_providers():
                await image_gen_service.sync_models()
            if video_gen_service.active_providers():
                await video_gen_service.sync_models()
            if speech_service.active_providers():
                await speech_service.sync_models()
        except Exception as e:
            logger.warning("Startup model sync skipped or failed: %s", e)

    import asyncio
    asyncio.create_task(_startup_sync_models())

    yield
    logger.info("Shutting down Apiapia assistant backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.APP_VERSION,
    description="Apiapia Assistant API: multi-model routing with Mem0 OSS long-term memory",
    lifespan=lifespan
)
install_error_handler(app)

# Starlette makes the most recently added middleware the outermost.
# 从外到内是 CORS → Locale → MaxBodySize，顺序是刻意排的：
#
#   - CORS 在最外，413 之类的拒绝才会带上 Access-Control-Allow-Origin，
#     浏览器才能报出「请求体过大」而不是一句看不懂的 CORS 失败。
#   - Locale 必须在 MaxBodySize **内侧**。反过来的话，MaxBodySize 会在
#     Locale 跑到之前就返回 413，而那条消息是 tr() 查出来的 ——
#     结果就是唯一一个必然要显示给用户、又必然被这个网关拦下的错误，
#     永远是默认语言。
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
app.add_middleware(LocaleMiddleware)

# CORS Middleware: 严格只允许 *.apiapia.com 以及本地开发调试端口
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*apiapia\.com$",
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
    """Actually talk to Postgres instead of claiming it works.

    Returns ``(ok, detail)``. The detail is the exception *type* only — this
    endpoint is unauthenticated (Docker's healthcheck has no token), so a driver
    message could carry the DSN or credentials. The full error goes to the log.
    """
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
    """Liveness/readiness for the container.

    This is what ``docker-compose``'s healthcheck curls, so the values here decide
    whether the container is reported healthy. Every field used to be a hardcoded
    string — including ``"database": "connected"`` — which meant a backend whose
    database was gone still looked perfectly healthy to Docker and to any monitor.

    Returns 503 when the database is unreachable so ``curl -f`` fails and Docker
    marks the container unhealthy. Docker does not restart on unhealthy, so this
    reports rather than disrupts.
    """
    # Imported here, not at module scope: the health path should not depend on the
    # memory subsystem's import graph, and is_configured() is a settings lookup.
    from app.services.memory.service import memory_service

    # Same reasoning, and this one matters more: pulling in the speech service at
    # module scope would make the health check import httpx and the config
    # singleton, so a broken speech import would take down /api/health — the one
    # endpoint Docker uses to decide whether the container is alive.
    from app.services.speech.service import speech_service

    db_ok, db_detail = await _probe_database()
    memory_ready = memory_service.is_configured()

    # Speech is reported by catalog state, not by naming a model. Which model an
    # account gets comes from its own user_settings row, so printing the
    # fallback constants here would advertise a "configured" model that nobody
    # is actually using. What an operator needs to know is whether the catalog
    # has been synced — an unsynced catalog is the single most common cause of
    # speech not working.
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
