"""Credential resolution for the long-term memory subsystem."""

import logging
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger("memory_credentials")

#: Fallback model when the caller supplies none.
DEFAULT_MEMORY_MODEL = "gpt-4o-mini"
DEFAULT_MEMORY_EMBEDDER = "text-embedding-3-small"


def _openai_first() -> Optional[Dict[str, Any]]:
    """Return the OpenAI credential if configured, else None.

    Checked first because it is the only provider whose model ids work unchanged
    on both direct and aggregated endpoints.
    """
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip():
        return {
            "api_key": settings.OPENAI_API_KEY,
            "base_url": settings.OPENAI_BASE_URL or "https://api.openai.com/v1",
            # OpenRouter needs the vendor prefix; OpenAI does not.
            "prefix_models": False,
            "default_model": DEFAULT_MEMORY_MODEL,
            "default_embedder": DEFAULT_MEMORY_EMBEDDER,
        }
    if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip():
        return {
            "api_key": settings.OPENROUTER_API_KEY,
            "base_url": settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1",
            "prefix_models": True,
            "default_model": f"openai/{DEFAULT_MEMORY_MODEL}",
            "default_embedder": f"openai/{DEFAULT_MEMORY_EMBEDDER}",
        }
    return None


def _normalize_openrouter_model(model: str) -> str:
    """Normalize common model alias typos for OpenRouter endpoints.

    OpenRouter uses dots for Claude versions (claude-3.5-sonnet, claude-3.5-haiku)
    and 'gemini-pro-1.5' instead of 'gemini-1.5-pro'.
    """
    alias_map = {
        # Anthropic Claude legacy -> current synced endpoints
        "anthropic/claude-3-5-sonnet": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3-5-sonnet-20241022": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3-5-sonnet-latest": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3-7-sonnet": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-5.5",
        "anthropic/claude-3-5-haiku": "anthropic/claude-haiku-5.5",
        "anthropic/claude-3.5-haiku": "anthropic/claude-haiku-5.5",

        # OpenAI legacy -> current synced endpoints
        "openai/gpt-4o-mini": "openai/gpt-6-luna",
        "openai/gpt-4o": "openai/gpt-6.1-sol",

        # DeepSeek legacy -> current synced endpoints
        "deepseek/deepseek-chat": "deepseek/deepseek-v4.1-flash-1017",
        "deepseek/deepseek-chat:free": "openrouter/free",

        # Google Gemini & Meta legacy -> current synced endpoints
        "google/gemini-1.5-pro": "google/gemini-3.8-flash",
        "google/gemini-pro-1.5": "google/gemini-3.8-flash",
        "google/gemini-1.5-flash": "google/gemini-3.8-flash",
        "google/gemini-2.0-flash": "google/gemini-3.8-flash",
        "google/gemini-2.0-flash-exp:free": "nvidia/nemotron-3.5-super-vl:free",
        "meta-llama/llama-3.3-70b-instruct:free": "nvidia/nemotron-3-ultra-550b-a55b:free",
    }
    cleaned = (model or "").strip()
    return alias_map.get(cleaned, cleaned)


def _apply_prefix(model: str, credential: Dict[str, Any]) -> str:
    """Qualify a bare model id for the endpoint the credential points at.

    A name that already carries a vendor prefix (``anthropic/claude-...``) is left
    alone; only bare ids like ``gpt-4o-mini`` get one, because that is the form
    OpenRouter rejects.
    """
    if not credential.get("prefix_models"):
        # Direct OpenAI or non-OpenRouter provider: map openrouter/free to default, strip openai/ prefix
        if model == "openrouter/free":
            return credential.get("default_model", DEFAULT_MEMORY_MODEL)
        if model.startswith("openai/"):
            return model[len("openai/"):]
        return model
    normalized = _normalize_openrouter_model(model)
    return normalized if "/" in normalized else f"openai/{normalized}"


def resolve_memory_credential(
    memory_model: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve the credential the memory subsystem should use.

    Returns a dict with:
      ``available``    — False when no usable key is configured at all
      ``api_key``      — the key (empty string when unavailable)
      ``base_url``     — endpoint, or None to let the library decide
      ``llm_model``    — ``memory_model`` resolved for this endpoint, with default
      ``embed_model``  — embedding model id for this endpoint, with default

    ``available`` exists because both callers treat "no key" as a normal state,
    not an error: memory extraction and dreaming are skipped, and the app keeps
    working without long-term memory.
    """
    credential = _openai_first()

    if credential is None:
        requested = (memory_model or "").strip() or DEFAULT_MEMORY_MODEL
        return {
            "available": False,
            "api_key": "",
            "base_url": None,
            "llm_model": requested,
            "embed_model": DEFAULT_MEMORY_EMBEDDER,
        }

    requested_llm = (memory_model or "").strip() or credential["default_model"]
    return {
        "available": True,
        "api_key": credential["api_key"],
        "base_url": credential["base_url"],
        "llm_model": _apply_prefix(requested_llm, credential),
        "embed_model": credential["default_embedder"],
    }