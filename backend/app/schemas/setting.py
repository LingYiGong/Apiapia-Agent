from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

from app.services.llm.factory import SUPPORTED_PROVIDERS  # noqa: F401

MAX_API_KEY_LEN = 512


class UserSettingUpdate(BaseModel):
    default_model: Optional[str] = Field(default=None, max_length=100)
    memory_model: Optional[str] = Field(default=None, max_length=100)
    consolidation_model: Optional[str] = Field(default=None, max_length=120)
    image_model: Optional[str] = Field(default=None, max_length=120)
    video_model: Optional[str] = Field(default=None, max_length=120)
    stt_model: Optional[str] = Field(default=None, max_length=120)
    tts_model: Optional[str] = Field(default=None, max_length=120)
    system_prompt: Optional[str] = None
    custom_instructions_about_user: Optional[str] = None
    custom_instructions_response_style: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    memory_enabled: Optional[bool] = None
    web_search_mode: Optional[str] = Field(default=None, max_length=10)


class UserSettingResponse(BaseModel):
    id: str
    user_id: str
    default_model: Optional[str] = None
    memory_model: Optional[str] = "openai/gpt-4o-mini"
    consolidation_model: Optional[str] = "nvidia/nemotron-3-ultra-550b-a55b:free"

    @field_validator("default_model", mode="after")
    @classmethod
    def resolve_default_model(cls, v: Optional[str]) -> str:
        if not v:
            from app.core.config import settings
            return settings.DEFAULT_MODEL
        return v
    image_model: Optional[str] = None
    video_model: Optional[str] = None
    stt_model: Optional[str] = None
    tts_model: Optional[str] = None
    system_prompt: str
    custom_instructions_about_user: Optional[str] = ""
    custom_instructions_response_style: Optional[str] = ""
    temperature: float
    memory_enabled: bool
    web_search_mode: str = "auto"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModelConfigCreate(BaseModel):
    """Create or replace the credential for one (provider, model) pair."""

    provider: str = Field(min_length=1, max_length=50)
    model: str = Field(min_length=1, max_length=100)
    api_key: Optional[str] = Field(default=None, max_length=MAX_API_KEY_LEN)
    base_url: Optional[str] = Field(default=None, max_length=255)
    enabled: bool = True


class ModelConfigUpdate(BaseModel):
    """Partial update of an existing credential."""

    api_key: Optional[str] = Field(default=None, max_length=MAX_API_KEY_LEN)
    base_url: Optional[str] = Field(default=None, max_length=255)
    enabled: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    """Credential response model."""

    id: str
    user_id: str
    provider: str
    model: str
    has_api_key: bool
    base_url: Optional[str] = None
    enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
