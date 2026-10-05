from pydantic import BaseModel
from datetime import datetime
from typing import Optional


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
    provider: str
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    enabled: bool = True


class ModelConfigUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    enabled: Optional[bool] = None


class ModelConfigResponse(BaseModel):
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
