from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Apiapia 助理"
    API_V1_STR: str = "/api"

    #: Release version of this service, reported by GET / and the OpenAPI docs.
    #:
    #: It must match the repo-root VERSION file and frontend/package.json — they
    #: ship as one artefact. It used to be hardcoded twice inside main.py and had
    #: drifted to 2.9.0 while the frontend and VERSION were already on v2.12.0, so
    #: the v2.12.0 changelog entry claiming "version unified across five sources"
    #: was not true of the backend. One literal here, overridable with APP_VERSION.
    APP_VERSION: str = "2.13.0"

    # PostgreSQL Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "apiapia"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@postgres:5432/apiapia",
        description="Async SQLAlchemy database URL"
    )
    MEM0_DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@postgres:5432/apiapia",
        description="Sync PostgreSQL URL for Mem0 pgvector"
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

    # Mem0 OSS
    # The embedder provider is not configurable: app.services.memory.credentials
    # always resolves it from the same OpenAI/OpenRouter credential the memory LLM
    # uses, and Mem0's own config takes a single key for both. MEM0_LLM_PROVIDER and
    # MEM0_EMBEDDER_PROVIDER used to exist here and were read nowhere — the
    # MEM0_EMBEDDER_PROVIDER one was worse than dead, it made is_configured() report
    # "available" for a huggingface setup that then failed to build an embedder.
    MEM0_VERSION: str = "2.2.1"
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

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
