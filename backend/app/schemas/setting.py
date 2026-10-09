from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# Re-exported for the credential endpoints, which validate a submitted provider
# name against it. The authoritative definition is app.services.llm.factory.
from app.services.llm.factory import SUPPORTED_PROVIDERS  # noqa: F401

#: Generous upper bound for a provider key. Real keys are 30-200 chars; the cap
#: exists so the Text column cannot be used to store arbitrary payloads.
MAX_API_KEY_LEN = 512


class UserSettingUpdate(BaseModel):
    # Length caps mirror the column widths in models/setting.py. Without them an
    # over-long value reached Postgres and came back as an unhandled
    # DataError — a 500 with a driver message, for what is really bad input.
    # With them it is a 422 that names the offending field.
    default_model: Optional[str] = Field(default=None, max_length=100)
    memory_model: Optional[str] = Field(default=None, max_length=100)
    image_model: Optional[str] = Field(default=None, max_length=120)
    video_model: Optional[str] = Field(default=None, max_length=120)
    # Two audio columns, not one: speech-to-text and text-to-speech are disjoint
    # model families upstream, so each direction is chosen (and validated)
    # separately. See the comment on models/setting.py.
    stt_model: Optional[str] = Field(default=None, max_length=120)
    tts_model: Optional[str] = Field(default=None, max_length=120)
    system_prompt: Optional[str] = None
    # 0-2 is the range every provider in SUPPORTED_PROVIDERS accepts. Unbounded,
    # this value is forwarded verbatim, so a stray 1000 came back as an opaque
    # upstream 400 from whichever provider happened to be selected.
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    memory_enabled: Optional[bool] = None
    web_search_mode: Optional[str] = Field(default=None, max_length=10)


class UserSettingResponse(BaseModel):
    id: str
    user_id: str
    default_model: str
    memory_model: Optional[str] = "openai/gpt-4o-mini"
    image_model: Optional[str] = None
    video_model: Optional[str] = None
    stt_model: Optional[str] = None
    tts_model: Optional[str] = None
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
