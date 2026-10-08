import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send
from app.core.config import settings
from app.core.database import engine, init_db
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
                        "detail": (
                            f"请求体过大（{length // (1024 * 1024)}MB），"
                            f"上限 {self.max_bytes // (1024 * 1024)}MB。"
                            "请减少附件数量或体积后重试。"
                        )
                    },
                    # Literal rather than status.HTTP_413_*: Starlette renamed that
                    # constant in 2024 (REQUEST_ENTITY_TOO_LARGE → CONTENT_TOO_LARGE)
                    # and kept the old name as a deprecation alias, so depending on
                    # it means this file breaks on one upgrade or the other.
                    status_code=413,
                )(scope, receive, send)
                return

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
    yield
    logger.info("Shutting down Apiapia assistant backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.APP_VERSION,
    description="Apiapia 助理 API：多模型解耦调度与 Mem0 OSS 长期记忆",
    lifespan=lifespan
)

# Starlette makes the most recently added middleware the outermost, so adding
# MaxBodySize first leaves CORS on the outside. That is the order we want: the 413
# this gate returns then carries Access-Control-Allow-Origin, so a browser reports
# "请求体过大" instead of an opaque CORS failure. Prepending it outside CORS would
# hide the reason from exactly the clients that most need to read it.
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)

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

    db_ok, db_detail = await _probe_database()
    memory_ready = memory_service.is_configured()

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
        "version": app.version,
    }

    if not db_ok:
        return JSONResponse(status_code=503, content=payload)
    return payload


app.include_router(api_router, prefix=settings.API_V1_STR)
