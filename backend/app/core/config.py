from importlib.metadata import PackageNotFoundError, version as _pkg_version
from pathlib import Path
from urllib.parse import quote

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings
from typing import Optional


def _get_default_version() -> str:
    """Read version dynamically from repo-root or app-root VERSION file if available."""
    search_paths = [
        Path(__file__).resolve().parent.parent.parent.parent / "VERSION",  # repo root (local dev)
        Path(__file__).resolve().parent.parent.parent / "VERSION",         # /app/VERSION (docker)
        Path("/app/VERSION"),
        Path("VERSION"),
    ]
    for p in search_paths:
        try:
            if p.is_file():
                content = p.read_text(encoding="utf-8").strip()
                if content:
                    return content.lstrip("vV")
        except Exception:
            pass
    return "0.0.0-dev"


def _installed_mem0_version() -> str:
    """Report the mem0ai version actually installed."""
    try:
        return _pkg_version("mem0ai")
    except PackageNotFoundError:
        return "unknown"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Apiapia 助理"
    API_V1_STR: str = "/api"

    #: Release version of this service, reported by GET / and the OpenAPI docs.
    #: Dynamically read from the root VERSION file, overridable with APP_VERSION env var.
    APP_VERSION: str = Field(default_factory=_get_default_version)

    # PostgreSQL Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "apiapia"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    #: When unset, assembled dynamically from POSTGRES_* fields.
    DATABASE_URL: str = Field(
        default="",
        description="Async SQLAlchemy database URL; derived from POSTGRES_* when empty"
    )
    MEM0_DATABASE_URL: str = Field(
        default="",
        description="Sync PostgreSQL URL for Mem0 pgvector; derived from POSTGRES_* when empty"
    )

    # JWT & Auth
    SECRET_KEY: str = Field(
        default="change-this-to-a-super-secret-jwt-key-min-32-chars-long",
        description="Secret key for JWT token encode/decode"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Symmetric Key for encrypting API Keys stored in DB
    API_KEY_ENCRYPTION_KEY: str = Field(
        default="dGhpc2lzYTMyeWVhcnNvbGRzZWNyZXRrZXkxMjM0NTY=",
        description="Fernet 32-byte urlsafe-base64 key for encrypting stored provider keys"
    )

    # Super Admin Configuration
    ADMIN_EMAIL: Optional[str] = None
    ADMIN_USERNAME: Optional[str] = None

    # CORS Configuration (comma-separated origins and optional regex)
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Comma-separated allowed origins for CORS"
    )
    CORS_ORIGIN_REGEX: Optional[str] = Field(
        default=r"^https://([a-zA-Z0-9-]+\.)*apiapia\.com$",
        description="Optional regex pattern for allowed CORS origins"
    )

    # Mem0 OSS
    MEM0_VERSION: str = Field(default_factory=_installed_mem0_version)
    MEM0_DATA_DIR: str = "/app/data/mem0"

    MEDIA_DIR: str = "/app/data/media"

    # LLMs
    DEFAULT_MODEL: str = "openrouter/free"
    DEFAULT_PROVIDER: str = "openrouter"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # OpenRouter (aggregates Claude, GPT, Llama, DeepSeek, Gemini, etc.)
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"

    GEMINI_API_KEY: Optional[str] = None

    OLLAMA_BASE_URL: Optional[str] = None

    # Tavily AI Search (LLM-native web search, primary when configured)
    TAVILY_API_KEY: Optional[str] = None
    TAVILY_SEARCH_DEPTH: str = "advanced"
    TAVILY_INCLUDE_ANSWER: bool = True

    # Image Generation (DALL-E 3, SiliconFlow / Flux.1)
    IMAGE_GEN_PROVIDER: str = "auto"  # 'auto', 'openai', 'siliconflow', 'openrouter'
    IMAGE_GEN_MODEL: str = "dall-e-3"  # 'dall-e-3', 'black-forest-labs/FLUX.1-schnell'
    SILICONFLOW_API_KEY: Optional[str] = None
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"

    # Zero-cost image models (comma-separated, tried in order)
    FREE_IMAGE_MODELS: str = "inclusionai/ming-image-0.1-design"

    # Video Generation (OpenRouter)
    VIDEO_GEN_PROVIDER: str = "auto"
    VIDEO_GEN_MODEL: str = ""
    FREE_VIDEO_MODELS: str = ""

    # Speech defaults (OpenRouter STT + TTS)
    STT_MODEL: str = "openai/whisper-large-v3"
    TTS_MODEL: str = "google/gemini-3.8-flash-tts"
    TTS_VOICE: str = ""
    FREE_AUDIO_MODELS: str = ""
    SPEECH_MAX_AUDIO_BYTES: int = 25 * 1024 * 1024
    SPEECH_MAX_TEXT_CHARS: int = 4000

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

    @model_validator(mode="after")
    def _assemble_database_urls(self) -> "Settings":
        """Fill unset DATABASE_URL / MEM0_DATABASE_URL from POSTGRES_* fields."""
        if not self.DATABASE_URL.strip():
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{quote(self.POSTGRES_USER, safe='')}:"
                f"{quote(self.POSTGRES_PASSWORD, safe='')}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        if not self.MEM0_DATABASE_URL.strip():
            self.MEM0_DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://", 1
            )
        return self


settings = Settings()
