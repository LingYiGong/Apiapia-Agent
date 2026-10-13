"""
The chat model catalog and the account entitlement that gates it.

Extracted out of ``app/api/v1/models.py`` because four modules needed it —
the chat endpoint, the settings endpoint, the image-model validator and the models
router itself — and having it live in the router meant the **API layer was
importing the API layer** (``api.v1.chat`` → ``api.v1.settings`` →
``api.v1.models``). That is what produced the hand-maintained
"keep in sync with factory.py" comments: a rule duplicated because the natural
home for it was unreachable.

Nothing here talks HTTP or FastAPI. The catalog is a JSON file on disk; the
entitlement is two columns on ``users``.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx

from app.core.config import settings
from app.core.i18n import tr
from app.models.user import User

logger = logging.getLogger("model_catalog")

#: Persistent synced models file, sibling of main.py: backend/app/synced_models.json
SYNCED_MODELS_FILE = Path(__file__).resolve().parent.parent / "synced_models.json"

#: The one model id that is free by definition. Named separately because three
#: call sites need to reference it by value, not just test membership.
OPENROUTER_FREE_MODEL_ID = "openrouter/free"

#: Model ids that are free by definition and must stay usable no matter what the
#: catalog says. ``openrouter/free`` is in here rather than relying on the file
#: because /models/configured injects it into its *response* when OpenRouter is
#: active — it is never written to synced_models.json, so a fresh install that has
#: not synced yet has no record of it anywhere.
ALWAYS_FREE_MODEL_IDS = frozenset({OPENROUTER_FREE_MODEL_ID})


def is_free_model(m: dict) -> bool:
    """Whether a catalog entry may be used by an account without full access.

    Three signals, all of them trustworthy:

    * ``is_free`` — written by the sync code from the provider's own pricing data
      (OpenRouter reports zero pricing for ``:free`` ids), or by our own fetchers
      for Ollama / DALL·E / SiliconFlow.
    * :data:`ALWAYS_FREE_MODEL_IDS` — see above.
    * ``provider == "ollama"`` — ``provider`` is written by *our* sync code from
      the upstream we actually queried, so an ``ollama`` entry can only have come
      from the operator's own machine. Those models cost the operator nothing.

    What is deliberately **not** here any more: the ``"-free" in mid`` /
    ``"免费" in name`` style substring guessing this used to do. That predicate was
    an authorisation decision derived from a display string, and it disagreed with
    ``detect_provider``: a model named ``ollama-gpt-4o`` passed the free check (it
    contains "ollama") and then routed to *openai* — so a trial account could bill
    the server by picking a name. Authorisation is decided by exact id lookup,
    which cannot be steered by a crafted string.
    """
    if m.get("is_free") is True:
        return True
    mid = (m.get("id") or "").lower()
    if mid in ALWAYS_FREE_MODEL_IDS or mid.endswith(":free"):
        return True
    return m.get("provider") == "ollama"


def has_full_model_access(user: User) -> bool:
    """
    Whether the account is entitled to billable models at all.

    Used both for chat model gating and for billable side features such as
    AI image generation, so the rule stays defined in exactly one place.
    """
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "can_access_all_models", False)
    )


def check_user_can_use_model(user: User, model_id: str) -> bool:
    """Gate a chat model against the account's entitlement.

    Fails closed. An id absent from the synced catalog is *unknown*, not free.

    Note this ignores whether the caller supplied their own credential, so an
    account without full access cannot use a billable model even with their own
    key. That is the pre-existing policy; whether it should be revisited is a
    product decision, not a bug fix.
    """
    if has_full_model_access(user):
        return True

    mid = (model_id or "").strip()
    if not mid:
        return False
    if mid.lower() in ALWAYS_FREE_MODEL_IDS or mid.lower().endswith(":free"):
        return True

    matched = next((m for m in load_stored_models() if m.get("id") == mid), None)
    return bool(matched) and is_free_model(matched)


def read_json_catalog(file_path: Path) -> List[Dict[str, Any]]:
    """Safely read a catalog JSON list from disk."""
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"Error reading {file_path.name}: {e}")
        return []


def write_json_catalog(file_path: Path, models: List[Dict[str, Any]]) -> bool:
    """Safely write a catalog list to disk as formatted JSON."""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(models, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error writing {file_path.name}: {e}")
        return False


#: Parsed contents of SYNCED_MODELS_FILE, keyed by the file's identity on disk.
#: Chat authorisation calls load_stored_models() once per turn, so without this
#: every message re-reads and re-parses a catalog that can run to a thousand
#: entries. Keyed on (mtime_ns, size) rather than a timer, so POST /models/sync —
#: which rewrites the file — is picked up on the very next read.
_store_cache: Dict[str, Any] = {"key": None, "models": []}


def load_stored_models() -> List[Dict[str, Any]]:
    """
    Read the catalog from synced_models.json.
    No models are hardcoded in the codebase.

    The returned list and its dicts are the cached objects. Callers must treat
    them as read-only; the one place that merges into entries (the sync endpoint)
    copies them first.
    """
    try:
        stat = SYNCED_MODELS_FILE.stat()
    except OSError:
        return []

    key = (stat.st_mtime_ns, stat.st_size)
    if _store_cache["key"] == key:
        return _store_cache["models"]

    data = read_json_catalog(SYNCED_MODELS_FILE)
    _store_cache["key"] = key
    _store_cache["models"] = data
    return data


def save_stored_models(models: List[Dict[str, Any]]) -> None:
    """Write the catalog to JSON."""
    try:
        write_json_catalog(SYNCED_MODELS_FILE, models)
    finally:
        # Drop the cache unconditionally: if the write failed the file still has
        # its old identity, and a stale entry would survive on that key.
        _store_cache["key"] = None
        _store_cache["models"] = []


# --- Live API Provider Fetchers for Chat Models ---


async def fetch_gemini_models_from_api(api_key: str) -> List[Dict[str, Any]]:
    """Dynamically fetch available models directly from Google Gemini API."""
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
                            "is_multimodal": True,
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
    """Dynamically fetch available chat/reasoning models directly from OpenAI API."""
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
                            "is_multimodal": "4o" in mid or "vision" in mid or "o1" in mid or "o3" in mid,
                        })
                models.sort(key=lambda x: x["id"], reverse=True)
            else:
                logger.warning(f"OpenAI API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to fetch OpenAI models: {e}")
    return models


async def fetch_openrouter_models_from_api(api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch all models from OpenRouter."""
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
                        "is_multimodal": is_multimodal,
                    })
    except Exception as e:
        logger.error(f"Failed to fetch OpenRouter models: {e}")
    return models


async def fetch_anthropic_models_from_api(api_key: str) -> List[Dict[str, Any]]:
    """Fetch available models directly from Anthropic API."""
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
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
                        "is_multimodal": any(k in mid.lower() for k in ["sonnet", "opus"]),
                    })
    except Exception as e:
        logger.error(f"Failed to fetch Anthropic models: {e}")
    return models


async def fetch_ollama_models_from_api(base_url: str) -> List[Dict[str, Any]]:
    """Fetch locally installed models from Ollama."""
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
                            "is_multimodal": False,
                        })
    except Exception as e:
        logger.error(f"Failed to fetch Ollama models: {e}")
    return models


async def sync_chat_models() -> Dict[str, Any]:
    """
    Query active LLM providers (Gemini, OpenAI, OpenRouter, Anthropic, Ollama)
    using the backend .env API keys and persist discovered models to synced_models.json.
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
        return {
            "success": False,
            "error": "后端 .env 中未配置任何模型提供商 API Key 或服务地址",
            "new_count": 0,
            "new_models": [],
            "total": len(load_stored_models()),
            "synced_providers": [],
        }

    current_models = [dict(m) for m in load_stored_models()]
    known_ids: Set[str] = {m["id"] for m in current_models}

    new_models: List[Dict[str, Any]] = []
    fetched_all: List[Dict[str, Any]] = []
    synced_providers = []

    if gemini_key:
        gemini_list = await fetch_gemini_models_from_api(gemini_key)
        if gemini_list:
            synced_providers.append("Gemini")
            fetched_all.extend(gemini_list)

    if openai_key:
        openai_list = await fetch_openai_models_from_api(openai_key, openai_base)
        if openai_list:
            synced_providers.append("OpenAI")
            fetched_all.extend(openai_list)

    if openrouter_key:
        or_list = await fetch_openrouter_models_from_api(openrouter_key)
        if or_list:
            synced_providers.append("OpenRouter")
            fetched_all.extend(or_list)

    if ollama_url:
        ollama_list = await fetch_ollama_models_from_api(ollama_url)
        if ollama_list:
            synced_providers.append("Ollama")
            fetched_all.extend(ollama_list)

    if anthropic_key:
        anthropic_list = await fetch_anthropic_models_from_api(anthropic_key)
        if anthropic_list:
            synced_providers.append("Anthropic")
            fetched_all.extend(anthropic_list)

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

    save_stored_models(merged_models)

    msg = (
        tr("SYNC_DONE_NEW", count=len(new_models))
        if new_models
        else tr("SYNC_DONE_UPTODATE")
    )

    return {
        "success": True,
        "new_count": len(new_models),
        "new_models": new_models,
        "total": len(merged_models),
        "synced_providers": synced_providers,
        "message": msg,
    }