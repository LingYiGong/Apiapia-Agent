import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from typing import List, Optional, Any
from app.core.database import get_db
from app.core.config import settings as app_settings
from app.core.net import UnsafeURLError, ensure_public_url
from app.core.security import encrypt_api_key
from app.models.user import User
from app.models.setting import UserSetting, ModelConfig
from app.schemas.setting import (
    UserSettingUpdate,
    UserSettingResponse,
    ModelConfigCreate,
    ModelConfigUpdate,
    ModelConfigResponse,
    SUPPORTED_PROVIDERS,
)
from app.api.v1.deps import get_current_user
from app.core.errors import ApiError
from app.core.i18n import tr
from app.services.catalog import has_full_model_access, check_user_can_use_model
from app.services.image_gen import image_gen_service
from app.services.video_gen import video_gen_service
from app.services.speech.service import CAPABILITY_STT, CAPABILITY_TTS, speech_service

from app.services.model_credentials import resolve_user_llm_credentials  # noqa: F401

logger = logging.getLogger("settings_api")

router = APIRouter(prefix="/settings", tags=["settings"])

#: Upper bound on stored credentials per account.
MAX_MODEL_CONFIGS_PER_USER = 20


async def _validate_base_url(base_url: Optional[str], provider: str) -> Optional[str]:
    """Validate that base_url is an allowed public HTTPS address."""
    candidate = (base_url or "").strip()
    if not candidate:
        return None

    try:
        return await ensure_public_url(candidate, allow_http=False)
    except UnsafeURLError as e:
        logger.info(
            "Refused base_url for provider=%s url=%r: %s", provider, candidate, e
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e


async def _validate_visual_model(
    current_user: User,
    model_id: Optional[str],
    service: Any,
    unavailable_code: str,
    forbidden_code: str,
) -> None:
    """Reject visual models that are unavailable or outside account entitlement."""
    model_id = (model_id or "").strip()
    if not model_id:
        return

    catalog = await service.list_available_models()
    entry = next((m for m in catalog if m["id"] == model_id), None)
    if entry is None:
        raise ApiError(status.HTTP_400_BAD_REQUEST, unavailable_code, model_id=model_id)
    if not has_full_model_access(current_user) and not entry.get("is_free"):
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            forbidden_code,
            name=entry.get("name") or model_id,
        )


async def _validate_image_model(current_user: User, model_id: Optional[str]) -> None:
    """Reject image models that are unavailable or outside the account entitlement."""
    await _validate_visual_model(
        current_user,
        model_id,
        image_gen_service,
        "MODEL_IMAGE_UNAVAILABLE",
        "TRIAL_IMAGE_MODEL_FORBIDDEN",
    )


async def _validate_video_model(current_user: User, model_id: Optional[str]) -> None:
    """Reject video models that are unavailable or outside the account entitlement."""
    await _validate_visual_model(
        current_user,
        model_id,
        video_gen_service,
        "MODEL_VIDEO_UNAVAILABLE",
        "TRIAL_VIDEO_MODEL_FORBIDDEN",
    )


async def _validate_audio_model(
    current_user: User, model_id: Optional[str], capability: str
) -> None:
    """Reject an audio model that is unavailable, of the wrong capability, or outside entitlement."""
    model_id = (model_id or "").strip()
    if not model_id:
        return

    label = tr("MODEL_KIND_STT" if capability == CAPABILITY_STT else "MODEL_KIND_TTS")
    catalog = await speech_service.list_available_models()
    entry = next(
        (m for m in catalog if m["id"] == model_id and m.get("capability") == capability),
        None,
    )
    if entry is None:
        # Distinguish "wrong kind of model" from "not available at all": the STT
        # selector being handed a TTS model is a far likelier mistake than a
        # stale id, and it deserves its own message.
        wrong_kind = next((m for m in catalog if m["id"] == model_id), None)
        if wrong_kind is not None:
            other = tr(
                "MODEL_KIND_TTS"
                if wrong_kind.get("capability") == CAPABILITY_TTS
                else "MODEL_KIND_STT"
            )
            raise ApiError(
                status.HTTP_400_BAD_REQUEST,
                "MODEL_AUDIO_WRONG_KIND",
                model_id=model_id,
                other=other,
                label=label,
            )
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "MODEL_AUDIO_UNAVAILABLE",
            label=label,
            model_id=model_id,
        )
    if not has_full_model_access(current_user) and not entry.get("is_free"):
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            "TRIAL_AUDIO_MODEL_FORBIDDEN",
            label=label,
            name=entry.get("name") or model_id,
        )


@router.get("", response_model=UserSettingResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        # Create default if not found
        setting = UserSetting(
            user_id=current_user.id,
            default_model=None,
            memory_model="openai/gpt-4o-mini",
            consolidation_model="openrouter/free",
            system_prompt="你是一个智能、真诚、有洞察力的个人智能助理。请根据用户提供的历史背景和长期记忆为用户提供高质量服务。",
            temperature=0.7,
            memory_enabled=True
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    elif not setting.memory_model:
        setting.memory_model = "openai/gpt-4o-mini"
        await db.commit()
        await db.refresh(setting)

    if not setting.consolidation_model:
        setting.consolidation_model = "openrouter/free"
        await db.commit()
        await db.refresh(setting)

    # For users restricted to free models, ensure default_model falls back to system default (None) if not permitted
    can_all = has_full_model_access(current_user)
    if not can_all:
        try:
            if setting.default_model and not check_user_can_use_model(current_user, setting.default_model):
                setting.default_model = None
                await db.commit()
                await db.refresh(setting)
        except Exception:
            pass

        # A previously stored paid image model must not survive a downgrade to
        # trial mode, otherwise the chat endpoint would have to reject it.
        if setting.image_model and not image_gen_service.is_free_image_model(setting.image_model):
            setting.image_model = None
            await db.commit()
            await db.refresh(setting)

        if setting.video_model and not video_gen_service.is_free_video_model(setting.video_model):
            setting.video_model = None
            await db.commit()
            await db.refresh(setting)

        # Same rule for both audio directions: a paid speech model stored before
        # an account was downgraded must not survive it, or /speech/* would have
        # to reject it at request time.
        if setting.stt_model and not speech_service.is_free_audio_model(setting.stt_model):
            setting.stt_model = None
            await db.commit()
            await db.refresh(setting)

        if setting.tts_model and not speech_service.is_free_audio_model(setting.tts_model):
            setting.tts_model = None
            await db.commit()
            await db.refresh(setting)

    # Same contract as default_model: an unset image model always resolves to the
    # zero-cost default, so it is never null and never silently becomes a paid
    # model. Applies to every account, not just trial ones.
    if not setting.image_model:
        fallback_image = image_gen_service.default_image_model()
        if fallback_image:
            setting.image_model = fallback_image
            await db.commit()
            await db.refresh(setting)

    if not setting.video_model:
        fallback_video = video_gen_service.default_video_model()
        if fallback_video:
            setting.video_model = fallback_video
            await db.commit()
            await db.refresh(setting)

    # Unset speech models resolve to the configured default rather than staying
    # null, so the frontend never has to decide what an empty selection means and
    # /speech/* always has a concrete model to send.
    if not setting.stt_model:
        fallback_stt = speech_service.default_model_for(CAPABILITY_STT)
        if fallback_stt:
            setting.stt_model = fallback_stt
            await db.commit()
            await db.refresh(setting)

    if not setting.tts_model:
        fallback_tts = speech_service.default_model_for(CAPABILITY_TTS)
        if fallback_tts:
            setting.tts_model = fallback_tts
            await db.commit()
            await db.refresh(setting)

    return setting


@router.patch("", response_model=UserSettingResponse)
async def update_user_settings(
    update_data: UserSettingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        setting = UserSetting(user_id=current_user.id)
        db.add(setting)

    if update_data.default_model is not None:
        chosen = update_data.default_model.strip()
        if chosen and not check_user_can_use_model(current_user, chosen):
            raise ApiError(status.HTTP_403_FORBIDDEN, "TRIAL_DEFAULT_MODEL_FORBIDDEN")
        setting.default_model = chosen or None
    if update_data.memory_model is not None:
        if getattr(current_user, "is_superuser", False):
            setting.memory_model = update_data.memory_model
    if update_data.consolidation_model is not None:
        if getattr(current_user, "is_superuser", False):
            setting.consolidation_model = update_data.consolidation_model
    if "image_model" in update_data.model_fields_set:
        await _validate_image_model(current_user, update_data.image_model)
        chosen = (update_data.image_model or "").strip()
        setting.image_model = chosen or image_gen_service.default_image_model()
    if "video_model" in update_data.model_fields_set:
        await _validate_video_model(current_user, update_data.video_model)
        chosen_video = (update_data.video_model or "").strip()
        setting.video_model = chosen_video or video_gen_service.default_video_model()
    if "stt_model" in update_data.model_fields_set:
        await _validate_audio_model(current_user, update_data.stt_model, CAPABILITY_STT)
        chosen_stt = (update_data.stt_model or "").strip()
        setting.stt_model = chosen_stt or speech_service.default_model_for(CAPABILITY_STT)
    if "tts_model" in update_data.model_fields_set:
        await _validate_audio_model(current_user, update_data.tts_model, CAPABILITY_TTS)
        chosen_tts = (update_data.tts_model or "").strip()
        setting.tts_model = chosen_tts or speech_service.default_model_for(CAPABILITY_TTS)
    if update_data.system_prompt is not None:
        setting.system_prompt = update_data.system_prompt
    if update_data.custom_instructions_about_user is not None:
        setting.custom_instructions_about_user = update_data.custom_instructions_about_user
    if update_data.custom_instructions_response_style is not None:
        setting.custom_instructions_response_style = update_data.custom_instructions_response_style
    if update_data.temperature is not None:
        setting.temperature = update_data.temperature
    if update_data.memory_enabled is not None:
        setting.memory_enabled = update_data.memory_enabled
    if update_data.web_search_mode is not None:
        mode = update_data.web_search_mode.strip().lower()
        if mode not in ("auto", "on", "off"):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_WEB_SEARCH_MODE",
                value=update_data.web_search_mode,
            )
        setting.web_search_mode = mode

    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(setting)

    return setting


# Caller-supplied provider credentials (BYO API key)
def _normalize_provider(raw: str) -> str:
    name = (raw or "").strip().lower()
    if name not in SUPPORTED_PROVIDERS:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "UNSUPPORTED_PROVIDER",
            value=raw,
            supported=", ".join(SUPPORTED_PROVIDERS),
        )
    return name


@router.get("/model-configs", response_model=List[ModelConfigResponse])
async def list_model_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the caller's own credentials. Never includes the key material."""
    stmt = (
        select(ModelConfig)
        .where(ModelConfig.user_id == current_user.id)
        .order_by(ModelConfig.provider.asc(), ModelConfig.model.asc())
    )
    return (await db.execute(stmt)).scalars().all()


@router.put("/model-configs", response_model=ModelConfigResponse)
async def upsert_model_config(
    payload: ModelConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the credential for one (provider, model) pair.

    Idempotent on (provider, model): resubmitting rotates the stored key rather
    than creating a duplicate row.
    """
    provider = _normalize_provider(payload.provider)
    model = payload.model.strip()
    api_key = (payload.api_key or "").strip()
    if not api_key:
        raise ApiError(status.HTTP_400_BAD_REQUEST, "API_KEY_REQUIRED")
    base_url = await _validate_base_url(payload.base_url, provider)

    stmt = select(ModelConfig).where(
        ModelConfig.user_id == current_user.id,
        ModelConfig.provider == provider,
        ModelConfig.model == model,
    )
    cfg = (await db.execute(stmt)).scalar_one_or_none()

    if cfg is None:
        count_stmt = select(func.count(ModelConfig.id)).where(ModelConfig.user_id == current_user.id)
        existing = (await db.execute(count_stmt)).scalar() or 0
        if existing >= MAX_MODEL_CONFIGS_PER_USER:
            raise ApiError(
                status.HTTP_400_BAD_REQUEST,
                "TOO_MANY_CREDENTIALS",
                max=MAX_MODEL_CONFIGS_PER_USER,
            )
        cfg = ModelConfig(user_id=current_user.id, provider=provider, model=model)
        db.add(cfg)

    cfg.api_key_encrypted = encrypt_api_key(api_key)
    cfg.base_url = base_url
    cfg.enabled = payload.enabled
    cfg.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(cfg)
    logger.info("Caller %s saved a credential for provider=%s model=%s (key_len=%d)",
                current_user.id, provider, model, len(api_key))
    return cfg


@router.patch("/model-configs/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: str,
    payload: ModelConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate the key, change the endpoint, or toggle enabled on one entry.

    Omitting api_key leaves the stored key untouched; sending "" clears it, after
    which the provider falls back to the server's own configuration.
    """
    cfg = await db.get(ModelConfig, config_id)
    # 404 rather than 403 for someone else's row: this endpoint must not confirm
    # that a given id exists in another account.
    if cfg is None or cfg.user_id != current_user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, "CREDENTIAL_NOT_FOUND")

    # model_fields_set distinguishes "not submitted" from an explicit null.
    if "api_key" in payload.model_fields_set:
        raw_key = payload.api_key or ""
        cfg.api_key_encrypted = encrypt_api_key(raw_key.strip()) if raw_key.strip() else None
        if not raw_key.strip():
            logger.info("Caller %s cleared the stored key for config=%s", current_user.id, config_id)

    if "base_url" in payload.model_fields_set:
        cfg.base_url = await _validate_base_url(payload.base_url, cfg.provider)

    if payload.enabled is not None:
        cfg.enabled = payload.enabled

    cfg.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cfg)
    return cfg


@router.delete("/model-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove one of the caller's credentials. Falls back to server config after."""
    cfg = await db.get(ModelConfig, config_id)
    if cfg is None or cfg.user_id != current_user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, "CREDENTIAL_NOT_FOUND")

    await db.delete(cfg)
    await db.commit()
    logger.info("Caller %s deleted credential config=%s", current_user.id, config_id)
    return None
