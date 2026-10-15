import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.models.user import User
from app.api.v1.deps import get_current_user, get_current_admin
from app.core.errors import ApiError
from app.services.catalog import (
    OPENROUTER_FREE_MODEL_ID,
    check_user_can_use_model,
    has_full_model_access,
    is_free_model,
    load_stored_models,
    save_stored_models,
    sync_chat_models,
    fetch_gemini_models_from_api,
    fetch_openai_models_from_api,
    fetch_openrouter_models_from_api,
    fetch_anthropic_models_from_api,
    fetch_ollama_models_from_api,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])


# Two routes used to live here and are gone:
#
#   GET /available   — returned the raw catalog. /configured is a strict superset
#                      for every caller that has a token, and nothing in the
#                      frontend ever called it.
#   GET /openrouter  — fetched the live OpenRouter catalog on demand, through a
#                      separate 10-minute cache. **Neither had auth**, so it was
#                      also an unauthenticated outbound proxy to a third party,
#                      with no rate limit. POST /sync covers the same need behind
#                      a login, and persists the result instead of re-fetching on
#                      every request.


@router.get("/configured")
async def list_configured_models(
    current_user: User = Depends(get_current_user)
):
    """
    Detect and return models whose providers have an active API Key
    configured in backend .env.
    Loaded strictly from synced_models.json without any models hardcoded in code.
    """
    stored = load_stored_models()
    active_providers = set()

    if settings.OPENROUTER_API_KEY:
        active_providers.add("openrouter")
    if settings.OPENAI_API_KEY:
        active_providers.add("openai")
    if settings.ANTHROPIC_API_KEY:
        active_providers.add("anthropic")
    if settings.GEMINI_API_KEY:
        active_providers.add("gemini")
    if settings.OLLAMA_BASE_URL and settings.OLLAMA_BASE_URL.strip():
        if any(m.get("provider") == "ollama" for m in stored):
            active_providers.add("ollama")

    # If catalog is empty but providers are configured, auto-fetch from APIs live on demand
    if not stored and active_providers:
        try:
            logger.info("Model catalog empty; automatically syncing live from configured providers on demand...")
            await sync_chat_models()
            stored = load_stored_models()
        except Exception as e:
            logger.warning("On-demand live model sync failed: %s", e)

    configured_models = [
        m for m in stored
        if m.get("provider") in active_providers
    ]

    # Ensure openrouter/free is always present if openrouter provider is active.
    # The id comes from the shared constant so this injection, the entitlement
    # check and the display sort cannot name different things.
    if "openrouter" in active_providers or bool(settings.OPENROUTER_API_KEY):
        if not any(m.get("id") == OPENROUTER_FREE_MODEL_ID for m in configured_models):
            configured_models.insert(0, {
                "id": OPENROUTER_FREE_MODEL_ID,
                "name": "OpenRouter Free (官方聚合免费模型)",
                "provider": "openrouter",
                "description": "由 OpenRouter 官方智能路由至当前最佳可用的免费大模型，稳定可靠",
                "is_free": True,
                "is_multimodal": True
            })

    can_all = has_full_model_access(current_user)
    if not can_all:
        configured_models = [m for m in configured_models if is_free_model(m)]

    def get_model_sort_priority(m: dict):
        mid = (m.get("id") or "").lower()
        if mid == OPENROUTER_FREE_MODEL_ID:
            return (0, 0, mid)
        if is_free_model(m):
            return (1, 0, mid)
        return (2, 0, mid)

    configured_models.sort(key=get_model_sort_priority)

    return {
        "active_providers": list(active_providers),
        "total": len(configured_models),
        "models": configured_models,
        "can_access_all_models": can_all
    }


@router.get("/image-models")
async def list_image_models(
    current_user: User = Depends(get_current_user)
):
    """
    Image generation catalog, read from the synced_image_models.json file that
    POST /models/sync-images populates.
    """
    from app.services.image_gen import image_gen_service

    catalog = await image_gen_service.list_available_models()
    if not catalog and image_gen_service.active_providers():
        try:
            logger.info("Image models empty; automatically syncing live from providers on demand...")
            await image_gen_service.sync_models()
            catalog = await image_gen_service.list_available_models()
        except Exception as e:
            logger.warning("On-demand image model sync failed: %s", e)

    can_all = has_full_model_access(current_user)
    if not can_all:
        catalog = [m for m in catalog if m.get("is_free")]

    return {
        "total": len(catalog),
        "models": catalog,
        "can_access_all_models": can_all,
        "synced": bool(image_gen_service.load_stored_models()),
    }


@router.post("/sync-images")
async def sync_image_models_from_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Query the configured image providers live and persist the result to
    synced_image_models.json, mirroring POST /models/sync for chat models.
    """
    from app.services.image_gen import image_gen_service

    if not image_gen_service.active_providers():
        raise ApiError(status.HTTP_400_BAD_REQUEST, "NO_IMAGE_CREDENTIALS")

    return await image_gen_service.sync_models()


@router.get("/video-models")
async def list_video_models(
    current_user: User = Depends(get_current_user)
):
    """
    Video generation catalog, read from synced_video_models.json that
    POST /models/sync-videos populates.
    """
    from app.services.video_gen import video_gen_service

    can_all = has_full_model_access(current_user)
    if not can_all:
        catalog = []
    else:
        catalog = await video_gen_service.list_available_models()
        if not catalog and video_gen_service.active_providers():
            try:
                logger.info("Video models empty; automatically syncing live from providers on demand...")
                await video_gen_service.sync_models()
                catalog = await video_gen_service.list_available_models()
            except Exception as e:
                logger.warning("On-demand video model sync failed: %s", e)

    return {
        "total": len(catalog),
        "models": catalog,
        "can_access_all_models": can_all,
        "synced": bool(video_gen_service.load_stored_models()),
    }


@router.post("/sync-videos")
async def sync_video_models_from_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Query configured video providers live and persist the result to
    synced_video_models.json.
    """
    from app.services.video_gen import video_gen_service

    if not video_gen_service.active_providers():
        raise ApiError(status.HTTP_400_BAD_REQUEST, "NO_VIDEO_CREDENTIALS")

    return await video_gen_service.sync_models()


@router.get("/audio-models")
async def list_audio_models(
    current_user: User = Depends(get_current_user)
):
    """
    Speech catalog, read from the synced_audio_models.json file that
    POST /models/sync-audio populates.
    """
    from app.services.speech.service import speech_service

    catalog = await speech_service.list_available_models()
    if not catalog and speech_service.active_providers():
        try:
            logger.info("Audio models empty; automatically syncing live from providers on demand...")
            await speech_service.sync_models()
            catalog = await speech_service.list_available_models()
        except Exception as e:
            logger.warning("On-demand audio model sync failed: %s", e)

    can_all = has_full_model_access(current_user)
    if not can_all:
        catalog = [m for m in catalog if m.get("is_free")]

    return {
        "total": len(catalog),
        "models": catalog,
        "can_access_all_models": can_all,
        "synced": bool(speech_service.load_stored_models()),
    }


@router.post("/sync-audio")
async def sync_audio_models_from_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Query OpenRouter for speech-to-text and text-to-speech models live and persist
    the result to synced_audio_models.json.
    """
    from app.services.speech.service import speech_service

    if not speech_service.active_providers():
        raise ApiError(status.HTTP_400_BAD_REQUEST, "NO_AUDIO_CREDENTIALS")

    return await speech_service.sync_models()


@router.post("/sync")
async def sync_models_from_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Manually query active LLM providers (Gemini, OpenAI, OpenRouter, Anthropic, Ollama)
    using the backend .env API keys and persist new models to synced_models.json.
    """
    res = await sync_chat_models()
    if not res.get("success"):
        detail = res.get("error") or tr("SYNC_FAILED")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    return res

