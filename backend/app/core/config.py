import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Apiapia 助理"
    API_V1_STR: str = "/api"

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
    MEM0_VERSION: str = "2.2.1"
    MEM0_LLM_PROVIDER: str = "openai"
    MEM0_EMBEDDER_PROVIDER: str = "openai"
    MEM0_DATA_DIR: str = "/app/data/mem0"

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
    TAVILY_MAX_RESULTS: int = 5
    TAVILY_INCLUDE_ANSWER: bool = True

    # Image Generation (DALL-E 3, SiliconFlow / Flux.1)
    IMAGE_GEN_PROVIDER: str = "auto"  # 'auto', 'openai', 'siliconflow'
    IMAGE_GEN_MODEL: str = "dall-e-3"  # 'dall-e-3', 'black-forest-labs/FLUX.1-schnell'
    SILICONFLOW_API_KEY: Optional[str] = None
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
