"""
Caller-supplied LLM credentials ("bring your own key").

Moved out of ``app/api/v1/settings.py`` because the chat endpoint needs to resolve
a credential on every turn, and reaching into a sibling *router* module for it is
what made the API layer import itself.

The module is deliberately narrow: it reads and decrypts, and nothing else. It
never validates a base_url — that happens when the credential is stored
(:func:`app.api.v1.settings._validate_base_url`), not on every chat turn.
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

    Returns ``(api_key, base_url)``. Either may be ``None``, which is not an error:
    it means "no override stored", and every provider constructor then falls back to
    the server's own .env configuration. Disabled rows are ignored, so a user can
    park a credential without deleting it.

    Both values are returned together or not at all. A row's base_url is never
    handed back without its key, because the provider constructors fall back to
    the *server's* credential when api_key is None — that would ship the server's
    key to a caller-chosen endpoint.

    Callers must never log the returned api_key.
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
        # Either the caller cleared the key, or the ciphertext no longer decrypts
        # (e.g. API_KEY_ENCRYPTION_KEY was rotated). Both degrade to "use the
        # server's configuration" — in full, base_url included.
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