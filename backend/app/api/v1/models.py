import json
import logging
from typing import List, Dict, Any, Set
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.models.user import User
from app.api.v1.deps import get_current_user
from app.services.catalog import (
    OPENROUTER_FREE_MODEL_ID,
    check_user_can_use_model,
    has_full_model_access,
    is_free_model,
    load_stored_models,
    save_stored_models,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

# The catalog itself (SYNCED_MODELS_FILE, load/save_stored_models, is_free_model,
# has_full_model_access, check_user_can_use_model) now lives in
# app/services/catalog.py. It is imported by four modules, and keeping it in this
# router meant api.v1.chat → api.v1.settings → api.v1.models — the API layer
# importing itself.


async def fetch_gemini_models_from_api(api_key: str) -> List[Dict[str, Any]]:
    """
    Dynamically fetch available models directly from Google Gemini API.
    Filters models that support content generation (generateContent).
    """
    headers = {"x-goog-api-key": api_key}
    models = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://generativelanguage.googleapis.com/v1beta/models", headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("models", [])
                for m in data:
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        clean_id = m.get("name", "").replace("models/", "")
                        display_name = m.get("displayName") or clean_id
                        desc = m.get("description") or f"Google {display_name}"
                        desc = desc.split("\n")[0][:120]
                        models.append({
                            "id": clean_id,
                            "name": f"{display_name} (Gemini)",
                            "provider": "gemini",
                            "description": desc,
                            "is_multimodal": True
                        })
                def sort_gemini(item):
                    mid = item["id"]
                    if "2.5" in mid: return 0
                    if "2.0" in mid: return 1
                    if "1.5" in mid: return 2
                    return 3
                models.sort(key=sort_gemini)
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to fetch Gemini models: {e}")
    return models


async def fetch_openai_models_from_api(api_key: str, base_url: str = "https://api.openai.com/v1") -> List[Dict[str, Any]]:
    """
    Dynamically fetch available chat/reasoning models directly from OpenAI API.
    """
    headers = {"Authorization": f"Bearer {api_key}"}
    models = []
    try:
        url = f"{base_url.rstrip('/')}/models"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for item in data:
                    mid = item.get("id", "")
                    if mid.startswith(("gpt-", "o1", "o3", "chatgpt-")):
                        models.append({
                            "id": mid,
                            "name": f"{mid} (OpenAI)",
                            "provider": "openai",
                            "description": "OpenAI 官方直连模型",
                            "is_multimodal": "4o" in mid or "vision" in mid or "o1" in mid or "o3" in mid
                        })
                models.sort(key=lambda x: x["id"], reverse=True)
            else:
                logger.warning(f"OpenAI API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to fetch OpenAI models: {e}")
    return models


async def fetch_openrouter_models_from_api(api_key: str = None) -> List[Dict[str, Any]]:
    """
    Fetch all models from OpenRouter.
    """
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    models = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for item in data:
                    mid = item.get("id")
                    if not mid:
                        continue
                    is_free = (
                        ":free" in mid.lower()
                        or (
                            isinstance(item.get("pricing"), dict)
                            and item.get("pricing", {}).get("prompt") in ("0", 0, "0.0")
                            and item.get("pricing", {}).get("completion") in ("0", 0, "0.0")
                        )
                    )
                    is_multimodal = (
                        "image" in str(item.get("architecture", {}))
                        or any(k in mid.lower() for k in ["vision", "-vl", "4o", "gemini", "claude-3", "pixtral", "llava", "minicpm-v"])
                    )
                    models.append({
                        "id": mid,
                        "name": item.get("name") or mid,
                        "description": item.get("description", "")[:120],
                        "provider": "openrouter",
                        "is_free": is_free,
                        "is_multimodal": is_multimodal
                    })
    except Exception as e:
        logger.error(f"Failed to fetch OpenRouter models: {e}")
    return models


async def fetch_anthropic_models_from_api(api_key: str) -> List[Dict[str, Any]]:
    """
    Fetch available models directly from Anthropic API.
    """
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }
    models = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://api.anthropic.com/v1/models", headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for item in data:
                    mid = item.get("id", "")
                    display_name = item.get("display_name") or mid
                    models.append({
                        "id": mid,
                        "name": f"{display_name} (Anthropic)",
                        "provider": "anthropic",
                        "description": "Anthropic 官方直连模型",
                        "is_multimodal": any(k in mid.lower() for k in ["sonnet", "opus"])
                    })
    except Exception as e:
        logger.error(f"Failed to fetch Anthropic models: {e}")
    return models


async def fetch_ollama_models_from_api(base_url: str) -> List[Dict[str, Any]]:
    """
    Fetch locally installed models from Ollama.
    """
    models = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                tags = resp.json().get("models", [])
                for t in tags:
                    m_name = t.get("name")
                    if m_name:
                        models.append({
                            "id": m_name,
                            "name": f"{m_name} (Ollama Local)",
                            "provider": "ollama",
                            "description": "本地运行的 Ollama 模型",
                            "is_free": True,
                            "is_multimodal": False
                        })
    except Exception as e:
        logger.error(f"Failed to fetch Ollama models: {e}")
    return models


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

    Accounts without full model access only ever see the zero-cost entries, which
    are declared through FREE_IMAGE_MODELS because the OpenRouter images endpoint
    exposes no pricing information.
    """
    from app.services.image_gen import image_gen_service

    catalog = await image_gen_service.list_available_models()
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="后端 .env 中未配置任何生图服务凭证 (OPENROUTER_API_KEY / OPENAI_API_KEY / SILICONFLOW_API_KEY)"
        )

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

    catalog = await video_gen_service.list_available_models()
    can_all = has_full_model_access(current_user)
    if not can_all:
        catalog = [m for m in catalog if m.get("is_free")]

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="后端 .env 中未配置任何视频生成服务凭证 (OPENROUTER_API_KEY)"
        )

    return await video_gen_service.sync_models()


@router.post("/sync")
async def sync_models_from_providers(
    current_user: User = Depends(get_current_user)
):
    """
    Manually query active LLM providers (Gemini, OpenAI, OpenRouter, Anthropic, Ollama)
    using the backend .env API keys.
    Compares fetched models with existing stored models in synced_models.json and saves any new ones.
    """
    gemini_key = (settings.GEMINI_API_KEY or "").strip()
    openai_key = (settings.OPENAI_API_KEY or "").strip()
    openai_base = (settings.OPENAI_BASE_URL or "https://api.openai.com/v1").strip()
    openrouter_key = (settings.OPENROUTER_API_KEY or "").strip()
    anthropic_key = (settings.ANTHROPIC_API_KEY or "").strip()
    ollama_url = (settings.OLLAMA_BASE_URL or "").strip()

    active_providers = set()
    if openrouter_key:
        active_providers.add("openrouter")
    if openai_key:
        active_providers.add("openai")
    if gemini_key:
        active_providers.add("gemini")
    if anthropic_key:
        active_providers.add("anthropic")
    if ollama_url:
        active_providers.add("ollama")

    if not active_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="后端 .env 中未配置任何模型提供商 API Key 或服务地址"
        )

    # 1. Load currently stored models from synced_models.json
    # Shallow-copied per entry: load_stored_models() hands back the cached objects,
    # and step 7 updates them in place while merging. Without the copy a failed
    # write would leave the cache holding mutated entries under the *old* file key.
    current_models = [dict(m) for m in load_stored_models()]
    known_ids: Set[str] = {m["id"] for m in current_models}

    new_models: List[Dict[str, Any]] = []
    fetched_all: List[Dict[str, Any]] = []
    synced_providers = []

    # 2. Fetch Gemini
    if gemini_key:
        gemini_list = await fetch_gemini_models_from_api(gemini_key)
        if gemini_list:
            synced_providers.append("Gemini")
            fetched_all.extend(gemini_list)

    # 3. Fetch OpenAI
    if openai_key:
        openai_list = await fetch_openai_models_from_api(openai_key, openai_base)
        if openai_list:
            synced_providers.append("OpenAI")
            fetched_all.extend(openai_list)

    # 4. Fetch OpenRouter
    if openrouter_key:
        or_list = await fetch_openrouter_models_from_api(openrouter_key)
        if or_list:
            synced_providers.append("OpenRouter")
            fetched_all.extend(or_list)

    # 5. Fetch Ollama
    if ollama_url:
        ollama_list = await fetch_ollama_models_from_api(ollama_url)
        if ollama_list:
            synced_providers.append("Ollama")
            fetched_all.extend(ollama_list)

    # 6. Fetch Anthropic
    if anthropic_key:
        anthropic_list = await fetch_anthropic_models_from_api(anthropic_key)
        if anthropic_list:
            synced_providers.append("Anthropic")
            fetched_all.extend(anthropic_list)

    # 7. Compare with known_ids
    model_map = {m["id"]: m for m in current_models}
    for m in fetched_all:
        mid = m["id"]
        if mid not in known_ids:
            new_models.append(m)
            known_ids.add(mid)
            model_map[mid] = m
        else:
            model_map[mid].update(m)

    merged_models = list(model_map.values())
    merged_models.sort(key=lambda m: 0 if is_free_model(m) else 1)

    # 8. Save updated models to synced_models.json
    save_stored_models(merged_models)

    msg = f"同步成功！从提供商新增发现了 {len(new_models)} 个模型" if new_models else "同步完成，当前已是最新模型，未发现新模型"

    return {
        "success": True,
        "new_count": len(new_models),
        "new_models": new_models,
        "total": len(merged_models),
        "synced_providers": synced_providers,
        "message": msg
    }
