import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserSetting(Base):
    __tablename__ = "user_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    default_model = Column(String(100), default="gpt-4o-mini", nullable=False)
    memory_model = Column(String(100), default="openai/gpt-4o-mini", nullable=True)
    system_prompt = Column(Text, default="你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。", nullable=False)
    temperature = Column(Float, default=0.7, nullable=False)
    memory_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="settings")


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # openai, anthropic, gemini, ollama
    model = Column(String(100), nullable=False)    # e.g., gpt-4o, claude-3-5-sonnet, gemini-1.5-pro
    api_key_encrypted = Column(Text, nullable=True) # Encrypted with Fernet
    base_url = Column(String(255), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="model_configs")
