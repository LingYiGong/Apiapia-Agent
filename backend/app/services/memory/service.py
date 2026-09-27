import os
import logging
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

        config = {
            "vector_store": {
                "provider": "pgvector",
                "config": {
                    "dbname": settings.POSTGRES_DB,
                    "user": settings.POSTGRES_USER,
                    "password": settings.POSTGRES_PASSWORD,
                    "host": settings.POSTGRES_HOST,
                    "port": settings.POSTGRES_PORT,
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
        result = memory.add(data, user_id=user_id, metadata=metadata or {})
        return result if isinstance(result, list) else [result]

    def search_memory(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search relevant memories for a verified user_id using Mem0 2.2.1 filters."""
        if not query or not query.strip():
            return []
        memory = self._ensure_memory()
        if not memory:
            return []
        try:
            # In Mem0 2.2.1 OSS, search() requires filters={'user_id': ...}
            results = memory.search(query=query, filters={"user_id": user_id}, limit=limit)
            return results if isinstance(results, list) else []
        except Exception as e:
            try:
                # Fallback attempt
                results = memory.search(query=query, user_id=user_id, limit=limit)
                return results if isinstance(results, list) else []
            except Exception as inner_e:
                logger.warning("Error searching memory for user %s: %s", user_id, str(inner_e))
                return []

    def list_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve all memories belonging to a verified user_id."""
        memory = self._ensure_memory()
        if not memory:
            return []
        try:
            # In Mem0 2.2.1, try filters={'user_id': ...} first
            results = memory.get_all(filters={"user_id": user_id})
            return results if isinstance(results, list) else []
        except Exception:
            try:
                results = memory.get_all(user_id=user_id)
                return results if isinstance(results, list) else []
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
                # Ensure user_id isolation
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
