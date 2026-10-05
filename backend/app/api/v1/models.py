import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Set
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.models.user import User
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

# Persistent synced models file located in backend/app/synced_models.json
SYNCED_MODELS_FILE = Path(__file__).resolve().parent.parent.parent / "synced_models.json"


def is_free_model(m: dict) -> bool:
    mid = (m.get("id") or "").lower()
    mname = (m.get("name") or "").lower()
    return bool(
        m.get("is_free")
        or mid == "openrouter/free"
        or "openrouter/free" in mid
        or ":free" in mid
        or "/free" in mid
        or "-free" in mid
        or "(free)" in mname
        or "free" in mname
        or "免费" in mname
        or m.get("provider") == "ollama"
    )


def has_full_model_access(user: User) -> bool:
    """
    Whether the account is entitled to billable models at all.

    Used both for chat model gating and for billable side features such as
    AI image generation, so the rule stays defined in exactly one place.
    """
    return bool(getattr(user, "is_superuser", False) or getattr(user, "can_access_all_models", False))


def check_user_can_use_model(user: User, model_id: str) -> bool:
    if has_full_model_access(user):
        return True
    mid = (model_id or "").lower()
    if mid == "openrouter/free" or "openrouter/free" in mid or ":free" in mid or "/free" in mid or "-free" in mid or "ollama" in mid or "免费" in mid:
        return True
    stored = load_stored_models()
    matched = next((m for m in stored if m.get("id") == model_id), None)
    if matched:
        return is_free_model(matched)
    return False


def load_stored_models() -> List[Dict[str, Any]]:
    """
    Read saved models from synced_models.json file.
    No models are hardcoded in the codebase.
    """
    if SYNCED_MODELS_FILE.exists():
        try:
            with open(SYNCED_MODELS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.error(f"Error reading synced_models.json: {e}")
    return []


def save_stored_models(models: List[Dict[str, Any]]):
    """Write models list to JSON file."""
    try:
        SYNCED_MODELS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SYNCED_MODELS_FILE, "w", encoding="utf-8") as f:
            json.dump(models, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error writing synced_models.json: {e}")


# In-memory cache for OpenRouter live search
_openrouter_cache = {"models": [], "expires_at": 0}


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


@router.get("/available")
async def list_available_models():
    """List available model catalog loaded directly from synced_models.json."""
    return load_stored_models()


@router.get("/openrouter")
async def list_openrouter_models(q: str = ""):
    """
    Fetch all supported models directly from OpenRouter's live API with cache.
    """
    import time
    now = time.time()
    raw_models = []

    if _openrouter_cache["models"] and _openrouter_cache["expires_at"] > now:
        raw_models = _openrouter_cache["models"]
    else:
        raw_models = await fetch_openrouter_models_from_api(settings.OPENROUTER_API_KEY)
        if raw_models:
            _openrouter_cache["models"] = raw_models
            _openrouter_cache["expires_at"] = now + 600

    if q and q.strip():
        search = q.strip().lower()
        return [
            m for m in raw_models
            if search in m["id"].lower() or search in m["name"].lower()
        ]
    return raw_models


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

    # Ensure openrouter/free is always present if openrouter provider is active
    if "openrouter" in active_providers or bool(settings.OPENROUTER_API_KEY):
        if not any(m.get("id") == "openrouter/free" for m in configured_models):
            configured_models.insert(0, {
                "id": "openrouter/free",
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
        if mid == "openrouter/free":
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
    current_models = load_stored_models()
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
