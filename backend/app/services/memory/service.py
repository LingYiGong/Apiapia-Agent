import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.memory.models import MemoryItem

logger = logging.getLogger("mem0_service")


class MemoryService:
    """
    Adapter layer encapsulating Mem0 OSS (mem0ai==2.2.1).
    Explicitly configured with PostgreSQL + pgvector and persistent SQLite history.
    """

    def __init__(self):
        self._memory_instances: Dict[str, Any] = {}
        self._initialized = False

    def is_configured(self) -> bool:
        """Check if any valid key (OpenAI or OpenRouter) or local provider is available."""
        return bool(
            (settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip()) or
            (settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip()) or
            (settings.MEM0_EMBEDDER_PROVIDER == "huggingface")
        )

    def _get_config(self, memory_model: Optional[str] = None) -> Dict[str, Any]:
        os.makedirs(settings.MEM0_DATA_DIR, exist_ok=True)
        history_db_path = os.path.join(settings.MEM0_DATA_DIR, "mem0_history.db")

        # Automatically resolve LLM credentials: use OpenAI if present, else fallback to OpenRouter
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip():
            llm_key = settings.OPENAI_API_KEY
            llm_base_url = settings.OPENAI_BASE_URL
            default_llm_model = "gpt-4o-mini"
        elif settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip():
            llm_key = settings.OPENROUTER_API_KEY
            llm_base_url = "https://openrouter.ai/api/v1"
            default_llm_model = "openai/gpt-4o-mini"
        else:
            llm_key = ""
            llm_base_url = None
            default_llm_model = "gpt-4o-mini"

        chosen_model = memory_model.strip() if (memory_model and memory_model.strip()) else default_llm_model

        # Automatically resolve Embedder credentials: use OpenAI if present, else fallback to OpenRouter
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip():
            embed_key = settings.OPENAI_API_KEY
            embed_base_url = settings.OPENAI_BASE_URL
            embed_model = "text-embedding-3-small"
        elif settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip():
            embed_key = settings.OPENROUTER_API_KEY
            embed_base_url = "https://openrouter.ai/api/v1"
            embed_model = "openai/text-embedding-3-small"
        else:
            embed_key = ""
            embed_base_url = None
            embed_model = "text-embedding-3-small"

        llm_config: Dict[str, Any] = {
            "model": chosen_model,
            "api_key": llm_key,
        }
        if llm_base_url:
            llm_config["openai_base_url"] = llm_base_url

        embed_config: Dict[str, Any] = {
            "model": embed_model,
            "api_key": embed_key,
        }
        if embed_base_url:
            embed_config["openai_base_url"] = embed_base_url

        # Dynamically extract postgres connection parameters from MEM0_DATABASE_URL or DATABASE_URL
        db_user = settings.POSTGRES_USER
        db_password = settings.POSTGRES_PASSWORD
        db_host = settings.POSTGRES_HOST
        db_port = settings.POSTGRES_PORT
        db_name = settings.POSTGRES_DB

        url_to_parse = settings.MEM0_DATABASE_URL or settings.DATABASE_URL
        if url_to_parse:
            try:
                from urllib.parse import urlsplit, unquote
                clean_url = url_to_parse.replace("postgresql+asyncpg://", "postgresql://")
                parsed = urlsplit(clean_url)
                if parsed.username:
                    db_user = unquote(parsed.username)
                if parsed.password:
                    db_password = unquote(parsed.password)
                if parsed.hostname:
                    db_host = parsed.hostname
                if parsed.port:
                    db_port = parsed.port
                if parsed.path and len(parsed.path) > 1:
                    db_name = parsed.path.lstrip("/")
            except Exception as e:
                logger.warning("Failed to parse database URL for Mem0: %s", str(e))

        config = {
            "vector_store": {
                "provider": "pgvector",
                "config": {
                    "dbname": db_name,
                    "user": db_user,
                    "password": db_password,
                    "host": db_host,
                    "port": db_port,
                    "collection_name": "mem0_memories",
                }
            },
            "llm": {
                "provider": "openai",
                "config": llm_config
            },
            "embedder": {
                "provider": "openai",
                "config": embed_config
            },
            "history_db_path": history_db_path
        }

        return config

    def _ensure_memory(self, memory_model: Optional[str] = None):
        if not self.is_configured():
            logger.info("No LLM key configured. Mem0 long-term memory extraction and vector search are dormant.")
            return None

        cache_key = memory_model.strip() if (memory_model and memory_model.strip()) else "default"
        if cache_key in self._memory_instances:
            return self._memory_instances[cache_key]

        try:
            from mem0 import Memory
            config = self._get_config(memory_model=memory_model)
            logger.info("Initializing Mem0 OSS 2.2.1 (model=%s) with pgvector store at %s:%s", cache_key, settings.POSTGRES_HOST, settings.POSTGRES_PORT)
            instance = Memory.from_config(config)
            self._memory_instances[cache_key] = instance
            self._initialized = True
            return instance
        except Exception as e:
            logger.error("Failed to initialize Mem0 instance for model %s: %s", cache_key, str(e), exc_info=True)
            return None

    def add_memory(self, user_id: str, data: Any, metadata: Optional[Dict[str, Any]] = None, memory_model: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Add memory for a verified user_id.
        In mem0 2.2.1 OSS, extraction is ADD-only (does not guarantee automatic overwrite).
        """
        memory = self._ensure_memory(memory_model=memory_model)
        if not memory:
            return []
        logger.info("Adding memory for user %s with model %s", user_id, memory_model or "default")
        meta = (metadata or {}).copy()
        if "created_at" not in meta:
            meta["created_at"] = datetime.now(timezone.utc).isoformat()
        result = memory.add(data, user_id=user_id, metadata=meta)
        return result if isinstance(result, list) else [result]

    @staticmethod
    def _extract_results_list(raw: Any) -> List[Dict[str, Any]]:
        """Normalize Mem0 response which can be a dict {'results': [...]} or a list."""
        if not raw:
            return []
        if isinstance(raw, list):
            items = []
            for entry in raw:
                if isinstance(entry, dict) and "results" in entry and isinstance(entry["results"], list):
                    items.extend(entry["results"])
                elif isinstance(entry, dict) and "memories" in entry and isinstance(entry["memories"], list):
                    items.extend(entry["memories"])
                elif isinstance(entry, dict):
                    items.append(entry)
            return items
        if isinstance(raw, dict):
            if "results" in raw and isinstance(raw["results"], list):
                return raw["results"]
            if "memories" in raw and isinstance(raw["memories"], list):
                return raw["memories"]
            if "id" in raw or "memory" in raw or "text" in raw:
                return [raw]
        return []

    def search_memory(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search relevant memories for a verified user_id."""
        if not query or not query.strip():
            return []
        memory = self._ensure_memory()
        if not memory:
            return []
        try:
            # Primary: Mem0 OSS pgvector search uses user_id
            results = memory.search(query=query, user_id=user_id, limit=limit)
            items = self._extract_results_list(results)
            if not items:
                # Secondary fallback: try filters={'user_id': ...}
                results_fallback = memory.search(query=query, filters={"user_id": user_id}, limit=limit)
                items = self._extract_results_list(results_fallback)
            items = [self._normalize_memory_item(i) for i in items]
            logger.info("Search memory for user %s (query: '%s') found %d items: %s", user_id, query, len(items), items)
            return items
        except Exception as e:
            try:
                results = memory.search(query=query, filters={"user_id": user_id}, limit=limit)
                items = [self._normalize_memory_item(i) for i in self._extract_results_list(results)]
                logger.info("Search memory fallback for user %s (query: '%s') found %d items", user_id, query, len(items))
                return items
            except Exception as inner_e:
                logger.warning("Error searching memory for user %s: %s", user_id, str(inner_e))
                return []

    @staticmethod
    def _normalize_memory_item(item: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize created_at timestamp from top-level or metadata."""
        if not isinstance(item, dict):
            return item
        item_copy = dict(item)
        created_at = item_copy.get("created_at")
        metadata = item_copy.get("metadata")
        if isinstance(metadata, str):
            try:
                import json
                metadata = json.loads(metadata)
                item_copy["metadata"] = metadata
            except Exception:
                metadata = {}
        if not created_at and isinstance(metadata, dict):
            created_at = metadata.get("created_at") or metadata.get("timestamp")
        if not created_at:
            created_at = item_copy.get("updated_at")
        if created_at:
            item_copy["created_at"] = str(created_at)
        return item_copy

    @classmethod
    def _normalize_and_sort_memories(cls, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize created_at timestamp and sort descending (newest first)."""
        normalized = [cls._normalize_memory_item(i) for i in items if isinstance(i, dict)]

        def sort_key(entry: Dict[str, Any]) -> str:
            # Descending order by created_at / updated_at
            return str(entry.get("created_at") or entry.get("updated_at") or "")

        return sorted(normalized, key=sort_key, reverse=True)

    def list_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve all memories belonging to a verified user_id, sorted descending by created_at."""
        memory = self._ensure_memory()
        if not memory:
            return []
        try:
            raw = memory.get_all(user_id=user_id)
            items = self._extract_results_list(raw)
            if not items:
                raw2 = memory.get_all(filters={"user_id": user_id})
                items = self._extract_results_list(raw2)
            logger.info("Listed %d memories for user %s", len(items), user_id)
            return self._normalize_and_sort_memories(items)
        except Exception:
            try:
                raw = memory.get_all(filters={"user_id": user_id})
                items = self._extract_results_list(raw)
                logger.info("Listed %d memories for user %s (fallback)", len(items), user_id)
                return self._normalize_and_sort_memories(items)
            except Exception as e:
                logger.warning("Error listing memories for user %s: %s", user_id, str(e))
                return []

    def get_memory(self, user_id: str, memory_id: str) -> Optional[Dict[str, Any]]:
        """Get single memory by id and verify ownership."""
        memory = self._ensure_memory()
        if not memory:
            return None
        try:
            item = memory.get(memory_id)
            if item:
                if isinstance(item, dict) and "results" in item and isinstance(item["results"], list) and item["results"]:
                    item = item["results"][0]
                # Ensure user_id isolation
                if isinstance(item, dict):
                    if item.get("user_id") and item.get("user_id") != user_id:
                        return None
                    return item
            return None
        except Exception as e:
            logger.warning("Error getting memory %s: %s", memory_id, str(e))
            return None

    def update_memory(self, user_id: str, memory_id: str, data: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Update existing memory (manual correction)."""
        existing = self.get_memory(user_id, memory_id)
        if not existing:
            raise ValueError(f"Memory {memory_id} not found or access denied")

        memory = self._ensure_memory()
        result = memory.update(memory_id=memory_id, data=data)
        return result

    def delete_memory(self, user_id: str, memory_id: str) -> bool:
        """Delete specific memory after checking ownership."""
        existing = self.get_memory(user_id, memory_id)
        if not existing:
            raise ValueError(f"Memory {memory_id} not found or access denied")

        memory = self._ensure_memory()
        memory.delete(memory_id=memory_id)
        return True

    def delete_all_memories(self, user_id: str) -> bool:
        """Delete all memories belonging to user_id."""
        memory = self._ensure_memory()
        try:
            memory.delete_all(filters={"user_id": user_id})
        except Exception:
            memory.delete_all(user_id=user_id)
        return True


memory_service = MemoryService()
