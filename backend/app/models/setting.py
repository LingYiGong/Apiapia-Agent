import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserSetting(Base):
    __tablename__ = "user_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    default_model = Column(String(100), default=None, nullable=True)
    memory_model = Column(String(100), default="openai/gpt-4o-mini", nullable=True)
    consolidation_model = Column(String(120), default="nvidia/nemotron-3-ultra-550b-a55b:free", nullable=True)
    image_model = Column(String(120), default=None, nullable=True)
    video_model = Column(String(120), default=None, nullable=True)
    stt_model = Column(String(120), default=None, nullable=True)
    tts_model = Column(String(120), default=None, nullable=True)
    system_prompt = Column(Text, default="你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。", nullable=False)
    # ChatGPT-style Custom Instructions
    custom_instructions_about_user = Column(Text, default="", nullable=True)
    custom_instructions_response_style = Column(Text, default="", nullable=True)
    temperature = Column(Float, default=0.7, nullable=False)
    memory_enabled = Column(Boolean, default=True, nullable=False)
    # 'auto' | 'on' | 'off' — server-side so the preference follows the account
    web_search_mode = Column(String(10), default="auto", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="settings")

    @property
    def effective_default_model(self) -> str:
        """用户显式配置的模型优先；未配置时动态回退至全局配置的默认模型。"""
        if self.default_model:
            return self.default_model
        from app.core.config import settings
        return settings.DEFAULT_MODEL


class ModelConfig(Base):
    """A user-supplied credential / endpoint override for one provider+model pair.

    Rows are created and read exclusively through /settings/model-configs and are
    always scoped by user_id. api_key_encrypted is Fernet ciphertext and is NEVER
    returned by the API — callers see ``has_api_key`` instead.
    """

    __tablename__ = "model_configs"
    __table_args__ = (
        # One credential per (user, provider, model)
        UniqueConstraint("user_id", "provider", "model", name="uq_model_config_user_provider_model"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # openai, anthropic, gemini, ollama, openrouter
    model = Column(String(100), nullable=False)    # e.g., gpt-4o, claude-3-5-sonnet, gemini-1.5-pro
    api_key_encrypted = Column(Text, nullable=True) # Encrypted with Fernet
    base_url = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="model_configs")

    @property
    def has_api_key(self) -> bool:
        """Whether a key is stored, without ever exposing the ciphertext."""
        return bool(self.api_key_encrypted)
