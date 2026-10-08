import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from typing import List, Optional
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
from app.services.catalog import has_full_model_access, check_user_can_use_model
from app.services.image_gen import image_gen_service
from app.services.video_gen import video_gen_service

# resolve_user_llm_credentials used to live here and is imported by the chat
# endpoint on every turn, which made api.v1.chat import a sibling router. It is
# now app.services.model_credentials — see that module for the rationale.
from app.services.model_credentials import resolve_user_llm_credentials  # noqa: F401

logger = logging.getLogger("settings_api")

router = APIRouter(prefix="/settings", tags=["settings"])

#: Upper bound on stored credentials per account. These rows are user-created and
#: nothing in the UI needs more than a handful, so the cap exists to stop the
#: table being used as free storage.
MAX_MODEL_CONFIGS_PER_USER = 20


async def _validate_base_url(base_url: Optional[str], provider: str) -> Optional[str]:
    """Reject base_urls that would let a caller reach non-public addresses.

    A base_url makes *this server* issue the request, so a caller-supplied value is
    a server-side request forgery vector, not a client-side one. The actual checks
    live in :func:`app.core.net.ensure_public_url` and are shared with every other
    caller-influenced URL this process fetches — one copy, because when the rule
    lived only here the two paths that fetch user-supplied links had no checks at
    all. This wrapper only decides what to do with a rejection and adds the one rule
    specific to credentials: plaintext http is refused, because the caller's API key
    travels in the request.

    Together these mean a caller-supplied base_url can only ever address a public
    HTTPS endpoint. Self-hosted gateways (a private Ollama, an internal
    OpenAI-compatible proxy) are therefore deliberately out of scope — they belong
    in the server's own .env, where an operator controls them, via OLLAMA_BASE_URL /
    OPENAI_BASE_URL and friends.

    Resolution happens once, when the credential is saved, so the chat hot path
    never blocks on DNS. Known limitation: this cannot stop DNS rebinding, where a
    name resolves to a public IP now and a private IP by the time httpx connects.
    Closing that window properly requires the check at connect time.
    """
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


async def _validate_image_model(current_user: User, model_id: Optional[str]) -> None:
    """
    Reject image models that are unavailable or outside the account entitlement.
    Mirrors the entitlement rule used for chat models. An empty value clears the
    selection and is always allowed.
    """
    model_id = (model_id or "").strip()
    if not model_id:
        return

    catalog = await image_gen_service.list_available_models()
    entry = next((m for m in catalog if m["id"] == model_id), None)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"所选绘图模型当前不可用（对应服务未配置或模型已下架）：{model_id}"
        )
    if not has_full_model_access(current_user) and not entry.get("is_free"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"当前账号处于体验模式，仅可使用免费绘图模型；「{entry.get('name') or model_id}」为计费模型。"
        )


async def _validate_video_model(current_user: User, model_id: Optional[str]) -> None:
    """
    Reject video models that are unavailable or outside the account entitlement.
    """
    model_id = (model_id or "").strip()
    if not model_id:
        return

    catalog = await video_gen_service.list_available_models()
    entry = next((m for m in catalog if m["id"] == model_id), None)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"所选视频模型当前不可用（对应服务未配置或模型已下架）：{model_id}"
        )
    if not has_full_model_access(current_user) and not entry.get("is_free"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"当前账号处于体验模式，仅可使用免费视频模型；「{entry.get('name') or model_id}」为计费模型。"
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
            default_model=app_settings.DEFAULT_MODEL,
            memory_model="openai/gpt-4o-mini",
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

    # For users restricted to free models, ensure default_model falls back to openrouter/free if needed
    can_all = has_full_model_access(current_user)
    if not can_all:
        try:
            if not check_user_can_use_model(current_user, setting.default_model):
                setting.default_model = "openrouter/free"
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
        if not check_user_can_use_model(current_user, update_data.default_model):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="当前账号处于体验模式，仅支持使用免费模型，无法将默认模型设置为计费模型。"
            )
        setting.default_model = update_data.default_model
    if update_data.memory_model is not None:
        # Memory LLM is admin-only: silently ignore when set by ordinary users
        # (rejecting outright would break older clients that always submit it)
        if getattr(current_user, "is_superuser", False):
            setting.memory_model = update_data.memory_model
    # model_fields_set distinguishes an omitted field from an explicit null. A null
    # is normalized to the zero-cost default rather than stored, so image_model
    # is always concrete.
    if "image_model" in update_data.model_fields_set:
        await _validate_image_model(current_user, update_data.image_model)
        chosen = (update_data.image_model or "").strip()
        setting.image_model = chosen or image_gen_service.default_image_model()
    if "video_model" in update_data.model_fields_set:
        await _validate_video_model(current_user, update_data.video_model)
        chosen_video = (update_data.video_model or "").strip()
        setting.video_model = chosen_video or video_gen_service.default_video_model()
    if update_data.system_prompt is not None:
        setting.system_prompt = update_data.system_prompt
    if update_data.temperature is not None:
        setting.temperature = update_data.temperature
    if update_data.memory_enabled is not None:
        setting.memory_enabled = update_data.memory_enabled
    if update_data.web_search_mode is not None:
        mode = update_data.web_search_mode.strip().lower()
        if mode not in ("auto", "on", "off"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的联网检索模式：{update_data.web_search_mode}（可选 auto / on / off）"
            )
        setting.web_search_mode = mode

    setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(setting)

    return setting


# ══════════════════════════════════════════════════════════════════════════
# Caller-supplied provider credentials (BYO API key)
#
# Every route here is scoped to current_user.id. No route in the codebase ever
# returns the plaintext of a stored key — reads expose `has_api_key` instead, and
# the only place a key is decrypted is
# app.services.model_credentials.resolve_user_llm_credentials, which hands it
# straight to the provider constructor.
# ══════════════════════════════════════════════════════════════════════════


def _normalize_provider(raw: str) -> str:
    name = (raw or "").strip().lower()
    if name not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的 provider：{raw!r}（可选：{', '.join(SUPPORTED_PROVIDERS)}）"
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="api_key 不能为空。如需清除已保存的密钥，请改用 PATCH 并提交空字符串。"
        )
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"最多保存 {MAX_MODEL_CONFIGS_PER_USER} 组自定义凭证，请先删除不再使用的条目。"
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭证不存在")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="凭证不存在")

    await db.delete(cfg)
    await db.commit()
    logger.info("Caller %s deleted credential config=%s", current_user.id, config_id)
    return None
