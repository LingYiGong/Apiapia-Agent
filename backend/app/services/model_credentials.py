"""
Caller-supplied LLM credentials ("bring your own key").
"""

import logging
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_api_key
from app.models.setting import ModelConfig

logger = logging.getLogger("model_credentials")


async def resolve_user_llm_credentials(
    db: AsyncSession,
    user_id: str,
    provider: Optional[str],
    model: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Resolve the caller's own credential for one (provider, model) pair.

    Returns ``(api_key, base_url)`` or ``(None, None)``.
    """
    provider_name = (provider or "").strip().lower()
    model_name = (model or "").strip()
    if not provider_name or not model_name:
        return None, None

    stmt = select(ModelConfig).where(
        ModelConfig.user_id == user_id,
        ModelConfig.provider == provider_name,
        ModelConfig.model == model_name,
        ModelConfig.enabled == True,
    )
    cfg = (await db.execute(stmt)).scalar_one_or_none()
    if cfg is None:
        return None, None

    api_key = decrypt_api_key(cfg.api_key_encrypted) if cfg.api_key_encrypted else None
    if not api_key:
        if cfg.api_key_encrypted:
            logger.warning(
                "Stored credential for user=%s provider=%s model=%s could not be decrypted; "
                "falling back to server configuration", user_id, provider_name, model_name,
            )
        return None, None

    logger.info(
        "Using caller-supplied credential for user=%s provider=%s model=%s",
        user_id, provider_name, model_name,
    )
    return api_key, (cfg.base_url or "").strip() or None