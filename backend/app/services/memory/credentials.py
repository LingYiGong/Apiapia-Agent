"""
Credential resolution for the long-term memory subsystem.

The memory LLM and the embedding model need a key. Two modules needed one:
``extraction`` (to extract facts) and ``service`` (to hand Mem0 its config). Each
implemented "prefer OpenAI, else OpenRouter, else nothing", and they did not
agree on one detail that matters:

* ``extraction._get_llm_client`` prefixed a bare model name with ``openai/`` when
  routing through OpenRouter, because OpenRouter rejects ``gpt-4o-mini``.
* ``service._get_config`` sent the name through unchanged.

So a memory_model of ``"gpt-4o-mini"`` would extract facts successfully (prefixed)
and then fail to write them (unprefixed), with the write path's error surfacing as
an opaque Mem0 failure. The default value happens to already carry the prefix,
which is why this never showed up — the inconsistency only bites when an admin
types a model name without it.

One resolver now, and the prefixing is unconditional.
"""

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


def _apply_prefix(model: str, credential: Dict[str, Any]) -> str:
    """Qualify a bare model id for the endpoint the credential points at.

    A name that already carries a vendor prefix (``anthropic/claude-...``) is left
    alone; only bare ids like ``gpt-4o-mini`` get one, because that is the form
    OpenRouter rejects.
    """
    if not credential.get("prefix_models"):
        return model
    return model if "/" in model else f"openai/{model}"


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