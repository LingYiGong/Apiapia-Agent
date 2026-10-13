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
    """Report the mem0ai version actually installed, which is the only true one.

    requirements.txt pins mem0ai==2.2.1. Carrying the same number as an env var
    invited exactly the drift the pin prevents: the env value could say 2.2.1
    while the image carried something else, and /api/health would report the lie.
    """
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

    #: Left empty on purpose: when unset they are assembled from the POSTGRES_*
    #: parts above. That way the password lives in exactly one place in .env
    #: instead of three, and changing it cannot leave the DSNs pointing at the old
    #: one. Set either explicitly only when it must diverge from POSTGRES_* —
    #: e.g. an externally managed database.
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
    # The embedder provider is not configurable: app.services.memory.credentials
    # always resolves it from the same OpenAI/OpenRouter credential the memory LLM
    # uses, and Mem0's own config takes a single key for both. MEM0_LLM_PROVIDER and
    # MEM0_EMBEDDER_PROVIDER used to exist here and were read nowhere — the
    # MEM0_EMBEDDER_PROVIDER one was worse than dead, it made is_configured() report
    # "available" for a huggingface setup that then failed to build an embedder.
    MEM0_VERSION: str = Field(default_factory=_installed_mem0_version)
    MEM0_DATA_DIR: str = "/app/data/mem0"

    # Generated image storage. Images are written here as original bytes (never
    # re-encoded or resized) and served back through an authenticated endpoint,
    # so the database only ever holds a small metadata record.
    MEDIA_DIR: str = "/app/data/media"

    # LLMs
    DEFAULT_MODEL: str = "gpt-4o-mini"
    DEFAULT_PROVIDER: str = "openai"

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
    # Tavily bills include_answer as a separate item. It is on because the answer is
    # now parsed and injected into the system prompt as a cross-checkable hint
    # (see WebSearchOutcome.answer); set False to save the surcharge at the cost of
    # one more reasoning step for the model.
    TAVILY_INCLUDE_ANSWER: bool = True
    # The result count is not configurable: chat.py passes max_results=5 explicitly
    # (TAVILY_MAX_RESULTS existed here and was read nowhere).

    # Image Generation (DALL-E 3, SiliconFlow / Flux.1)
    IMAGE_GEN_PROVIDER: str = "auto"  # 'auto', 'openai', 'siliconflow', 'openrouter'
    IMAGE_GEN_MODEL: str = "dall-e-3"  # 'dall-e-3', 'black-forest-labs/FLUX.1-schnell'
    SILICONFLOW_API_KEY: Optional[str] = None
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"

    # Zero-cost image models served through OpenRouter. Only these may be used by
    # accounts WITHOUT full model access, and a failure here must never fall back
    # to a paid model. Comma-separated, tried in order.
    FREE_IMAGE_MODELS: str = "inclusionai/ming-image-0.1-design"

    # Video Generation (OpenRouter)
    VIDEO_GEN_PROVIDER: str = "auto"
    VIDEO_GEN_MODEL: str = ""
    FREE_VIDEO_MODELS: str = ""

# Speech (OpenRouter STT + TTS). Both directions ride the same
    # OPENROUTER_API_KEY as chat, so there is no new credential here.
    #
    # There is deliberately NO deployment-level knob for *which* models to use.
    # Users pick them in the settings page; the choice lands in
    # user_settings.stt_model / tts_model and /speech/* resolves it per account.
    # The browser never sends a model name, so an env var here could only ever be
    # a global override that silently disagrees with what each user selected.
    # These two constants exist solely so an account that has never opened the
    # speech section — and the window before the first catalog sync — still has
    # something concrete to send.
    STT_MODEL: str = "openai/whisper-large-v3"
    TTS_MODEL: str = "google/gemini-3.8-flash-tts"

    # Optional voice override, pinned at the source level rather than per user.
    # Leave empty and the synthesizer uses the first voice the synced catalog
    # reports for the selected model, which is correct for every model that
    # publishes its voice list. Pin it only to force one voice across the whole
    # deployment — a value the selected model does not accept is ignored rather
    # than breaking synthesis, so this is safe to leave alone.
    #
    # Models that publish NO voice list (the Fish Audio / Seed Audio families)
    # are handled by omitting `voice` from the request entirely, letting the
    # provider apply its own documented default.
    TTS_VOICE: str = ""

    # Zero-cost audio models, comma-separated, tried in order. Most are already
    # detectable from the provider's zero pricing, so this exists for the same
    # reason FREE_IMAGE_MODELS does: to register a free tier the pricing feed does
    # not surface, and to keep trial accounts usable if speech is ever gated.
    FREE_AUDIO_MODELS: str = ""

    # Ceiling on one audio upload. OpenRouter's multipart cap is 25 MB, so a
    # larger file would be rejected upstream after we had already buffered it —
    # this is the cheap local gate that turns that into an instant 413.
    SPEECH_MAX_AUDIO_BYTES: int = 25 * 1024 * 1024

    # Ceiling on one synthesis request. Providers disagree (ElevenLabs v4 takes
    # 10k chars, Fish/Seed far less), so this is the conservative bound; the
    # frontend splits longer replies before calling.
    SPEECH_MAX_TEXT_CHARS: int = 4000

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

    @model_validator(mode="after")
    def _assemble_database_urls(self) -> "Settings":
        """Fill an unset DATABASE_URL / MEM0_DATABASE_URL from the POSTGRES_* parts.

        The credentials are percent-encoded here. A generated password routinely
        contains ``@``, ``/`` or ``:``, and any of those would otherwise truncate
        the DSN and surface as an opaque driver error at startup rather than as a
        configuration mistake.
        """
        if not self.DATABASE_URL.strip():
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{quote(self.POSTGRES_USER, safe='')}:"
                f"{quote(self.POSTGRES_PASSWORD, safe='')}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        if not self.MEM0_DATABASE_URL.strip():
            # Same server and database, minus the async driver: mem0's pgvector
            # store goes through psycopg2 and cannot parse "postgresql+asyncpg://".
            self.MEM0_DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://", 1
            )
        return self


settings = Settings()
