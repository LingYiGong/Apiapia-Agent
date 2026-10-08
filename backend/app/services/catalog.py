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
from typing import Any, Dict, List

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
    if (m.get("id") or "").lower() in ALWAYS_FREE_MODEL_IDS:
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
    if mid.lower() in ALWAYS_FREE_MODEL_IDS:
        return True

    matched = next((m for m in load_stored_models() if m.get("id") == mid), None)
    return bool(matched) and is_free_model(matched)


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

    try:
        with open(SYNCED_MODELS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list):
                data = []
    except Exception as e:
        logger.error(f"Error reading synced_models.json: {e}")
        return []

    _store_cache["key"] = key
    _store_cache["models"] = data
    return data


def save_stored_models(models: List[Dict[str, Any]]):
    """Write the catalog to JSON."""
    try:
        SYNCED_MODELS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SYNCED_MODELS_FILE, "w", encoding="utf-8") as f:
            json.dump(models, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error writing synced_models.json: {e}")
    finally:
        # Drop the cache unconditionally: if the write failed the file still has
        # its old identity, and a stale entry would survive on that key.
        _store_cache["key"] = None
        _store_cache["models"] = []