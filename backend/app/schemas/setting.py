from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

#: Provider names the LLM factory knows how to build. Kept in sync with
#: app/services/llm/factory.py::get_llm_provider.
SUPPORTED_PROVIDERS = ("openai", "anthropic", "gemini", "ollama", "openrouter")

#: Generous upper bound for a provider key. Real keys are 30-200 chars; the cap
#: exists so the Text column cannot be used to store arbitrary payloads.
MAX_API_KEY_LEN = 512


class UserSettingUpdate(BaseModel):
    default_model: Optional[str] = None
    memory_model: Optional[str] = None
    image_model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    memory_enabled: Optional[bool] = None
    web_search_mode: Optional[str] = None


class UserSettingResponse(BaseModel):
    id: str
    user_id: str
    default_model: str
    memory_model: Optional[str] = "openai/gpt-4o-mini"
    image_model: Optional[str] = None
    system_prompt: str
    temperature: float
    memory_enabled: bool
    web_search_mode: str = "auto"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModelConfigCreate(BaseModel):
    """Create or replace the credential for one (provider, model) pair.

    Submitting an existing pair updates it in place — the database enforces one
    row per (user, provider, model).
    """

    provider: str = Field(min_length=1, max_length=50)
    model: str = Field(min_length=1, max_length=100)
    # Never echoed back. Omit to keep the stored key untouched on update.
    api_key: Optional[str] = Field(default=None, max_length=MAX_API_KEY_LEN)
    # Optional endpoint override, e.g. a self-hosted OpenAI-compatible gateway.
    base_url: Optional[str] = Field(default=None, max_length=255)
    enabled: bool = True


class ModelConfigUpdate(BaseModel):
    """Partial update of an existing credential.

    ``api_key=None`` means "leave the stored key alone". Pass an empty string to
    explicitly clear it. ``provider`` / ``model`` are intentionally absent: they
    form part of the uniqueness key, so changing them would silently create a
    second row instead of renaming this one. Delete and re-create instead.
    """

    api_key: Optional[str] = Field(default=None, max_length=MAX_API_KEY_LEN)
    base_url: Optional[str] = Field(default=None, max_length=255)
    enabled: Optional[bool] = None


class ModelConfigResponse(BaseModel):
    """Read model. Deliberately exposes has_api_key instead of the key itself —
    there is no endpoint anywhere that returns the plaintext of a stored key."""

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
