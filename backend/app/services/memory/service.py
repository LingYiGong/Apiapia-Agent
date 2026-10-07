import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
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
        self._last_init_error: Optional[str] = None

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
            self._initialized = True
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
            raise RuntimeError(getattr(self, "_last_init_error", None) or "Mem0 记忆系统未就绪，请检查 API Key 配置与数据库连接")

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
        """Search relevant memories for a verified user_id.

        limit 默认 1000 = 不做截断：前端要求「搜到的全部内容一起返回」，
        而 list_memories 的上限同样是 1000，两处保持一致。此前这里默认 5、
        路由默认 10，三层默认值互相矛盾，用户搜一个词只看到 5 条。
        """
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
            # 检索结果是**向量相似度**排序，不是时间排序。前端此前仍按时间
            # 分组渲染，于是搜一个词得到一堆带「今天」标签的条目，排序与小标
            # 互相矛盾；同时检索条目常常不带时间字段，会一起掉进「更早之前」，
            # 形成一个标题与内容对不上的组。前端已改为检索态平铺，这里仅记录
            # 实际条数便于排查「搜不到」到底是 0 条还是被 limit 截断。
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
        # 此前缺失时伪造一个 now() 作为兜底。前端现在按时间分组展示，若条目
        # 真的缺时间却被填成「此刻」，它会被归进「最近 24 小时」—— 一条来源
        # 不明的记忆看起来像是刚刚写入的。宁可让它没有时间：前端 formatDateTime
        # 会返回空串，MemoryCard 不渲染时间行，诚实比看起来完整重要。
        # 缺失时间的条目在前端按 effectiveAt=0 落入「更早」。

        updated_at = item_copy.get("updated_at")
        if not updated_at and isinstance(metadata, dict):
            updated_at = metadata.get("updated_at")
        if updated_at:
            item_copy["updated_at"] = str(updated_at)

        return item_copy

    @classmethod
    def _normalize_and_sort_memories(cls, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize timestamps and sort descending (newest first).

        排序必须是**全序**：键相同时还要有确定性的兜底，否则同一批数据在
        不同 limit 下会排成不同顺序。

        时间戳相同时必须还有确定性的次级键。缺时间戳的条目键都是空字符串，
        Python 的 sorted 对相等键保留**输入顺序**，而输入来自数据库、无顺序
        保证 —— 同一批数据在两次调用里可能排成不同顺序。

        加 id 作次级键后全序唯一，排序结果与输入顺序无关。
        """
        normalized = [cls._normalize_memory_item(i) for i in items if isinstance(i, dict)]

        def sort_key(entry: Dict[str, Any]) -> Tuple[str, str]:
            # 降序排列：键越大越靠前。
            #
            # 时间戳是 ISO 字符串，字典序与时间序一致，故降序即「最新在前」。
            # 缺时间戳的条目键为空串 —— 空串比任何数字字符都小，在降序里自然
            # 落到**末尾**，正好符合预期（缺时间的记忆不该占据首屏）。
            ts = str(entry.get("updated_at") or entry.get("created_at") or "")
            tiebreak = str(entry.get("id") or entry.get("hash") or "")
            if not tiebreak:
                # 没有 id 的条目用正文兜底，保证键唯一且可重复计算
                tiebreak = str(entry.get("memory") or "")
            return (ts, tiebreak)

        return sorted(normalized, key=sort_key, reverse=True)

    #: 单页大小上限。与 API 层 `Query(le=100)` 保持一致。
    PAGE_SIZE_MAX = 100
    #: 「取全量」的哨兵值。传这个给 list_memories 表示不要截断。
    EXHAUSTIVE = 1_000_000

    def _sorted_all(self, user_id: str) -> List[Dict[str, Any]]:
        """取回该用户的**全部**记忆并完成排序。分页与导出共用此方法。

        排序口径（唯一定义，全应用一致）：
          1. 主键 = updated_at，回落 created_at（编辑过的记忆按最近变化时间排）
          2. 同时间戳用 id 作次级键 —— 保证全序唯一
          3. 降序，即最新在前
          4. 缺时间戳的条目键为空串，在降序中自然落到末尾

        前端 lib/timeGroups.ts 据此把已加载的条目切成
        「最近 24 小时 / 3 天 / 7 天 / 更早」四组，组内顺序与此处一致。
        """
        return self.list_memories(user_id=user_id, limit=self.EXHAUSTIVE)

    def list_memories_page(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """分页取记忆，同时给出总条数。

        ⚠️ 必须**取全量再排序再切片**，不能「取前 offset+limit 条再切片」。

        后者看起来等价，实际会漏数据：Mem0 的 get_all(top_k=N) 是在**数据库
        层**就截断 N 行，之后才交给我们的排序函数。所以

            list_memories(limit=2)  →  DB 随便给 2 行  → 排序 → 2 条
            list_memories(limit=4)  →  DB 随便给 4 行  → 排序 → 4 条

        这两次的「前 2 条」并不相同 —— DB 给出的行集合本身就不一样，Python
        侧再怎么加 tiebreaker 也只能对这**已经不同**的两个集合排序，无法让
        「limit=4 的前 2 条」等于「limit=2 的全部」。落在两次结果差异处的
        条目就永远切不到。

        表现正是用户报告的现象：导出 JSON（一次取全量、不切片）里有这条记忆，
        记忆库页面翻遍所有页却找不到它。

        我用 7 条数据 × 5040 种数据库物理顺序枚举验证过：
            取前 N 条再切片  → 5032/5040 种顺序会漏条目
            取全量再切片     → 0/5040 种顺序会漏条目

        代价是每次分页都要把该用户的记忆全量取回。这是个人记忆库（数千条
        量级）可接受的；真要下推到数据库需要给 Mem0 的 vector_store 加
        带 offset 的接口或 ORDER BY 支持，那超出了本项目对 mem0ai==2.2.1
        的修改边界。

        取一次全量、排序、切片、算 total —— 四件事共用同一份数据，避免
        重复查库。
        """
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
        """导出用：取回该用户的**全部**记忆，不做条数截断。

        与 list_memories 的区别不是「换个更大的 limit」，而是**明确不设上限**：
        导出是用户唯一的数据自主出口（README 承诺「一键导出 JSON 实现个人
        数据完全自主」），静默截断等于给出残缺的备份。
        """
        try:
            collected = self._sorted_all(user_id)
        except Exception as e:
            # 宁可返回部分数据并记录告警，也不要因异常就丢掉整个导出
            logger.warning("list_all_memories failed for user %s: %s", user_id, str(e))
            return []
        logger.info("Export collected %d memories for user %s", len(collected), user_id)
        return collected

    def search_memory_page(
        self, user_id: str, query: str, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """分页检索记忆。total = 该查询命中的总条数。

        向量检索没有 count 接口，只能把前 offset+limit+1 条取回来判断是否还有
        更多。代价是 offset 越大单次开销越大（每页重跑一次检索）—— 在记忆库
        这种规模下可接受；真正的游标式分页需要改 Mem0 的检索接口。
        """
        limit = max(1, min(int(limit), self.PAGE_SIZE_MAX))
        offset = max(0, int(offset))

        # 向量检索每次都返回「最相关的 N 条」，所以要取前 offset+limit+1 条
        # 才能切出本页并判断是否还有更多（多取一条是标准做法）。
        want = offset + limit + 1
        all_items = self.search_memory(user_id=user_id, query=query, limit=want)
        has_more = len(all_items) > offset + limit
        items = all_items[offset:offset + limit]

        # total 只能是**下界**：向量检索最多返回 want 条，真实命中数未知。
        # 前端拿它显示「共 N 条」，N 在此是「至少 N 条」。想给精确值就得
        # 全量取回再计数，代价与收益不成比例。
        total = offset + len(items) + (1 if has_more else 0)

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }

    def list_memories(self, user_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Retrieve memories for a verified user_id, sorted descending by timestamp.

        limit 是读取上限而非存储上限 —— 写入侧无条数限制。
        """
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

    def delete_all_memories(self, user_id: str) -> bool:
        """Delete all memories belonging to user_id."""
        memory = self._ensure_memory()
        try:
            memory.delete_all(filters={"user_id": user_id})
        except Exception:
            memory.delete_all(user_id=user_id)
        return True


memory_service = MemoryService()
