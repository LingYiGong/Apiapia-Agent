import json
import math
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from app.services.memory.service import memory_service

logger = logging.getLogger("memory_retrieval")

# ── Recency decay constants ────────────────────────────────────────────────────
# weight = e^(-λ × days_since_created)
# importance-aware λ values:
#   importance ≥ 4  → no decay (permanent facts like "user is a software engineer")
#   importance = 3  → slow decay  (λ=0.005, half-life ≈ 139 days)
#   importance = 2  → fast decay  (λ=0.02,  half-life ≈ 35 days)
#   unknown         → mild decay  (λ=0.008, half-life ≈ 87 days)
_LAMBDA_BY_IMPORTANCE: Dict[int, float] = {
    5: 0.0,
    4: 0.0,
    3: 0.005,
    2: 0.02,
    1: 0.05,
}
_LAMBDA_DEFAULT = 0.008


# ── Scoring helpers ───────────────────────────────────────────────────────────

def _parse_importance(metadata: Any) -> int:
    """Safely extract importance from a memory's metadata dict."""
    if not isinstance(metadata, dict):
        return 0
    try:
        return int(metadata.get("importance", 0))
    except (TypeError, ValueError):
        return 0


def _recency_weight(created_at_str: Any, importance: int) -> float:
    """
    Compute e^(-λ × days) recency weight.
    High-importance memories (≥4) have λ=0 and therefore never decay.
    """
    lam = _LAMBDA_BY_IMPORTANCE.get(importance, _LAMBDA_DEFAULT)
    if lam == 0.0:
        return 1.0  # permanent — no decay

    if not created_at_str:
        return 0.8  # neutral fallback

    try:
        ts = str(created_at_str).replace("Z", "+00:00")
        created_at = datetime.fromisoformat(ts)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        days_ago = max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds() / 86400)
        return math.exp(-lam * days_ago)
    except Exception:
        return 0.8


def _compute_final_score(item: Dict[str, Any], parsed_metadata: Dict) -> float:
    """
    final_score = semantic_score × recency_weight(importance)

    semantic_score  — cosine similarity from pgvector, range [0, 1]
    recency_weight  — exponential decay based on age and importance
    """
    semantic = float(item.get("score") or 0.5)
    importance = _parse_importance(parsed_metadata)

    created_at = (
        item.get("created_at")
        or (parsed_metadata.get("created_at") if parsed_metadata else None)
        or item.get("updated_at")
    )
    recency = _recency_weight(created_at, importance)

    return semantic * recency


# ── Main retrieval function ───────────────────────────────────────────────────

def retrieve_relevant_memories(
    user_id: str,
    query: str,
    limit: int = 5,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Retrieve and rerank relevant memories using a composite score:

        final_score = semantic_score × recency_weight(importance)

    COMPLIANCE WITH ARCHITECTURE MANDATE 6:
    Memory injected into LLM MUST be treated as untrusted reference context
    and cannot override or act as authoritative system directives.
    """
    search_query = query.strip()
    # Guard against OpenAI embedding 8192 token limit error on long queries
    if len(search_query) > 2000:
        search_query = search_query[:2000]

    logger.info(
        "Searching relevant memories for user %s (query: '%.60s')", user_id, search_query
    )

    try:
        # Fetch 2× limit so reranking has enough candidates to choose from
        raw_memories = memory_service.search_memory(
            user_id=user_id, query=search_query, limit=limit * 2
        )
    except Exception as e:
        logger.warning("Failed to retrieve memories for user %s: %s", user_id, str(e))
        return [], ""

    if not raw_memories:
        logger.info("No memories matched query for user %s", user_id)
        return [], ""

    # ── Rerank ────────────────────────────────────────────────────────────────
    scored: List[Dict[str, Any]] = []
    for item in raw_memories:
        # Normalise metadata: Mem0 may return it as a JSON string
        meta = item.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        final = _compute_final_score(item, meta)
        scored.append({
            **item,
            "_parsed_meta": meta,
            "_final_score": final,
            "_semantic_score": float(item.get("score") or 0.5),
        })

    scored.sort(key=lambda x: x["_final_score"], reverse=True)
    top = scored[:limit]

    # ── Format output ─────────────────────────────────────────────────────────
    extracted_lines: List[str] = []
    clean_memories: List[Dict[str, Any]] = []

    for item in top:
        text = item.get("memory") or item.get("text") or str(item)
        if not (text and text.strip()):
            continue

        meta = item.get("_parsed_meta", {})
        importance = _parse_importance(meta)

        extracted_lines.append(f"- {text.strip()}")
        clean_memories.append({
            "id": str(item.get("id") or ""),
            "memory": text.strip(),
            "score": round(item["_final_score"], 4),
            "semantic_score": round(item["_semantic_score"], 4),
            "importance": importance or None,
        })

    if not extracted_lines:
        return [], ""

    logger.info(
        "Recalled %d memories (reranked by semantic × recency) for query '%.60s'",
        len(clean_memories), query,
    )

    bullet_points = "\n".join(extracted_lines)
    # Natural context framing — avoids triggering false safety auditor modes
    prompt_context = (
        "\n\n【用户相关历史记忆】\n"
        "（以下是系统检索到的与用户相关的历史事实与偏好信息，仅供回答时作为参考）：\n"
        f"{bullet_points}\n"
    )

    return clean_memories, prompt_context
