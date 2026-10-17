import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from app.core.config import settings
from app.services.memory.credentials import resolve_memory_credential

logger = logging.getLogger("mem0_service")


class MemoryService:
    """
    Adapter layer encapsulating Mem0 OSS (mem0ai==2.2.1).
    Explicitly configured with PostgreSQL + pgvector and persistent SQLite history.

    Note: Methods here are synchronous and use blocking drivers, so async callers
    must invoke them via asyncio.to_thread.
    """

    def __init__(self):
        self._memory_instances: Dict[str, Any] = {}
        self._last_init_error: Optional[str] = None

    def is_configured(self) -> bool:
        """Check if any valid key (OpenAI or OpenRouter) is available."""
        return resolve_memory_credential()["available"]

    def _get_config(self, memory_model: Optional[str] = None) -> Dict[str, Any]:
        os.makedirs(settings.MEM0_DATA_DIR, exist_ok=True)
        history_db_path = os.path.join(settings.MEM0_DATA_DIR, "mem0_history.db")

        credential = resolve_memory_credential(memory_model)

        llm_config: Dict[str, Any] = {
            "model": credential["llm_model"],
            "api_key": credential["api_key"],
        }
        if credential["base_url"]:
            llm_config["openai_base_url"] = credential["base_url"]

        embed_config: Dict[str, Any] = {
            "model": credential["embed_model"],
            "api_key": credential["api_key"],
        }
        if credential["base_url"]:
            embed_config["openai_base_url"] = credential["base_url"]

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
            self._last_init_error = "未配置 LLM API Key (OpenAI 或 OpenRouter)，长效记忆系统未激活"
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
            self._last_init_error = None
            return instance
        except Exception as e:
            logger.error("Failed to initialize Mem0 instance for model %s: %s", cache_key, str(e), exc_info=True)
            self._last_init_error = str(e)
            return None

    def add_memory(
        self,
        user_id: str,
        data: Any,
        metadata: Optional[Dict[str, Any]] = None,
        memory_model: Optional[str] = None,
        infer: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Add memory for a verified user_id.
        In mem0 2.2.1 OSS:
        - When infer=False (default for direct facts and manual entries), facts are written directly to pgvector without LLM extraction.
        - When infer=True, LLM extracts facts from conversation dialogue.
        """
        memory = self._ensure_memory(memory_model=memory_model)
        if not memory:
            raise RuntimeError(self._last_init_error or "Mem0 记忆系统未就绪，请检查 API Key 配置与数据库连接")

        logger.info("Adding memory for user %s with model %s (infer=%s)", user_id, memory_model or "default", infer)
        meta = (metadata or {}).copy()
        if "created_at" not in meta:
            meta["created_at"] = datetime.now(timezone.utc).isoformat()

        try:
            result = memory.add(data, user_id=user_id, metadata=meta, infer=infer)
        except TypeError:
            result = memory.add(data, user_id=user_id, metadata=meta)

        items = self._extract_results_list(result)
        if not items and result:
            if isinstance(result, list):
                items = result
            elif isinstance(result, dict):
                items = [result]

        if not items:
            items = [{"memory": data if isinstance(data, str) else str(data), "metadata": meta, "created_at": meta["created_at"]}]

        normalized = []
        for i in items:
            norm = self._normalize_memory_item(i)
            if not norm.get("memory") and isinstance(data, str):
                norm["memory"] = data
            if not norm.get("created_at"):
                norm["created_at"] = meta["created_at"]
            normalized.append(norm)

        return normalized

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

    def search_memory(self, user_id: str, query: str, limit: int = 1000) -> List[Dict[str, Any]]:
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
            logger.info(
                "Search memory for user %s (query: %r, limit=%d) found %d items",
                user_id, query, limit, len(items),
            )
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
        """Normalize created_at/updated_at timestamps and memory content from top-level or metadata."""
        if not isinstance(item, dict):
            return {"memory": str(item), "created_at": datetime.now(timezone.utc).isoformat()}
        item_copy = dict(item)
        if "memory" not in item_copy:
            if "data" in item_copy:
                item_copy["memory"] = item_copy["data"]
            elif "text" in item_copy:
                item_copy["memory"] = item_copy["text"]

        metadata = item_copy.get("metadata")
        if isinstance(metadata, str):
            try:
                import json
                metadata = json.loads(metadata)
                item_copy["metadata"] = metadata
            except Exception:
                metadata = {}

        created_at = item_copy.get("created_at")
        if not created_at and isinstance(metadata, dict):
            created_at = metadata.get("created_at") or metadata.get("timestamp")
        if not created_at:
            created_at = item_copy.get("updated_at")
        if created_at:
            item_copy["created_at"] = str(created_at)

        updated_at = item_copy.get("updated_at")
        if not updated_at and isinstance(metadata, dict):
            updated_at = metadata.get("updated_at")
        if updated_at:
            item_copy["updated_at"] = str(updated_at)

        return item_copy

    @classmethod
    def _normalize_and_sort_memories(cls, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize timestamps and sort descending (newest first, with id tiebreaker)."""
        normalized = [cls._normalize_memory_item(i) for i in items if isinstance(i, dict)]

        def sort_key(entry: Dict[str, Any]) -> Tuple[str, str]:
            # Sort descending by timestamp, falling back to id or content tiebreaker
            ts = str(entry.get("updated_at") or entry.get("created_at") or "")
            tiebreak = str(entry.get("id") or entry.get("hash") or "")
            if not tiebreak:
                tiebreak = str(entry.get("memory") or "")
            return (ts, tiebreak)

        return sorted(normalized, key=sort_key, reverse=True)

    #: 单页大小上限。与 API 层 `Query(le=100)` 保持一致。
    PAGE_SIZE_MAX = 100
    EXHAUSTIVE = 1_000_000

    def _sorted_all(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve and sort all memories for a user."""
        return self.list_memories(user_id=user_id, limit=self.EXHAUSTIVE)

    def list_memories_page(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """Paginate memories with total count."""
        limit = max(1, min(int(limit), self.PAGE_SIZE_MAX))
        offset = max(0, int(offset))

        all_items = self._sorted_all(user_id)
        items = all_items[offset:offset + limit]

        return {
            "items": items,
            "total": len(all_items),
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(items) < len(all_items),
        }

    def list_all_memories(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve all memories for export."""
        try:
            collected = self._sorted_all(user_id)
        except Exception as e:
            logger.warning("list_all_memories failed for user %s: %s", user_id, str(e))
            return []
        logger.info("Export collected %d memories for user %s", len(collected), user_id)
        return collected

    def search_memory_page(
        self, user_id: str, query: str, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """Paginate memory search results with estimated total count."""
        limit = max(1, min(int(limit), self.PAGE_SIZE_MAX))
        offset = max(0, int(offset))

        want = offset + limit + 1
        all_items = self.search_memory(user_id=user_id, query=query, limit=want)
        has_more = len(all_items) > offset + limit
        items = all_items[offset:offset + limit]
        total = offset + len(items) + (1 if has_more else 0)

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }

    def list_memories(self, user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Retrieve memories for a verified user_id, sorted descending by timestamp."""
        memory = self._ensure_memory()
        if not memory:
            return []
        items = []

        # 1. Primary: Mem0 OSS get_all with top_k=limit and limit=limit
        # In Mem0 OSS, the parameter is top_k (default 20), which dictates the database LIMIT!
        try:
            raw = memory.get_all(filters={"user_id": user_id}, top_k=limit, limit=limit)
            items = self._extract_results_list(raw)
        except TypeError:
            try:
                raw = memory.get_all(filters={"user_id": user_id}, top_k=limit)
                items = self._extract_results_list(raw)
            except TypeError:
                try:
                    raw = memory.get_all(filters={"user_id": user_id}, limit=limit)
                    items = self._extract_results_list(raw)
                except Exception as e:
                    logger.warning("Error calling memory.get_all with filters: %s", str(e))
            except Exception as e:
                logger.warning("Error calling memory.get_all with top_k: %s", str(e))
        except Exception as e:
            logger.warning("Primary list_memories failed for %s: %s", user_id, str(e))

        # 2. Secondary fallback: direct vector_store list if get_all returned empty or was capped
        if not items and hasattr(memory, "vector_store") and hasattr(memory.vector_store, "list"):
            try:
                raw = memory.vector_store.list(filters={"user_id": user_id}, limit=limit)
                items = self._extract_results_list(raw)
            except Exception as e:
                logger.debug("vector_store.list fallback error: %s", str(e))

        # 3. Tertiary fallback: legacy top-level user_id parameter
        if not items:
            try:
                raw = memory.get_all(user_id=user_id, top_k=limit, limit=limit)
                items = self._extract_results_list(raw)
            except TypeError:
                try:
                    raw = memory.get_all(user_id=user_id, limit=limit)
                    items = self._extract_results_list(raw)
                except TypeError:
                    try:
                        raw = memory.get_all(user_id=user_id)
                        items = self._extract_results_list(raw)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning("Fallback get_all(user_id=...) failed: %s", str(e))

        # 4. Quaternary fallback: get_all with only filters
        if not items:
            try:
                raw = memory.get_all(filters={"user_id": user_id})
                items = self._extract_results_list(raw)
            except Exception:
                pass

        logger.info("Listed %d memories for user %s (queried top_k/limit=%d)", len(items), user_id, limit)
        return self._normalize_and_sort_memories(items)

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
                # Ensure user_id isolation from top-level or metadata
                if isinstance(item, dict):
                    item_uid = item.get("user_id")
                    if not item_uid and isinstance(item.get("metadata"), dict):
                        item_uid = item["metadata"].get("user_id")
                    if item_uid and str(item_uid) != str(user_id):
                        return None
                    return item
            return None
        except Exception as e:
            logger.warning("Error getting memory %s: %s", memory_id, str(e))
            return None

    def update_memory(self, user_id: str, memory_id: str, data: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Update existing memory (manual correction), preserving metadata and user scope."""
        existing = self.get_memory(user_id, memory_id)
        if not existing:
            raise ValueError(f"Memory {memory_id} not found or access denied")

        memory = self._ensure_memory()

        # Merge metadata to preserve timestamps and user_id
        existing_meta = existing.get("metadata") or {}
        if isinstance(existing_meta, str):
            try:
                import json
                existing_meta = json.loads(existing_meta)
            except Exception:
                existing_meta = {}

        merged_meta = dict(existing_meta)
        if metadata:
            merged_meta.update(metadata)

        now_iso = datetime.now(timezone.utc).isoformat()
        merged_meta["updated_at"] = now_iso
        merged_meta["user_id"] = user_id
        if "created_at" not in merged_meta:
            merged_meta["created_at"] = existing.get("created_at") or now_iso

        try:
            # Mem0 2.2.1 accepts text and metadata
            result = memory.update(memory_id=memory_id, text=data, metadata=merged_meta)
        except TypeError:
            try:
                result = memory.update(memory_id=memory_id, data=data, metadata=merged_meta)
            except TypeError:
                result = memory.update(memory_id=memory_id, data=data)

        logger.info("Successfully updated memory %s for user %s", memory_id, user_id)
        return result

    def delete_memory(self, user_id: str, memory_id: str) -> bool:
        """Delete specific memory after checking ownership."""
        existing = self.get_memory(user_id, memory_id)
        if not existing:
            raise ValueError(f"Memory {memory_id} not found or access denied")

        memory = self._ensure_memory()
        memory.delete(memory_id=memory_id)
        return True


memory_service = MemoryService()
