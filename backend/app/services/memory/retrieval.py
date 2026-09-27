import logging
from typing import List, Dict, Any, Tuple
from app.services.memory.service import memory_service

logger = logging.getLogger("memory_retrieval")


def retrieve_relevant_memories(user_id: str, query: str, limit: int = 5) -> Tuple[List[Dict[str, Any]], str]:
    """
    Retrieve relevant memories for user_id and format them as an untrusted reference context block.
    
    COMPLIANCE WITH ARCHITECTURE MANDATE 6:
    Memory injected into LLM MUST be treated as untrusted reference context and cannot override
    or act as authoritative system directives.
    """
    search_query = query.strip()
    # Guard against OpenAI embedding 8192 token limit error on long user queries
    if len(search_query) > 2000:
        search_query = search_query[:2000]

    logger.info("Searching relevant memories for user %s (query: '%s')", user_id, search_query[:60])
    try:
        memories = memory_service.search_memory(user_id=user_id, query=search_query, limit=limit)
    except Exception as e:
        logger.warning("Failed to retrieve memories for user %s: %s", user_id, str(e))
        return [], ""

    if not memories:
        logger.info("No memories matched query '%s' for user %s", query, user_id)
        return [], ""

    extracted_lines = []
    clean_memories = []

    for item in memories:
        # Mem0 item may return {'id': ..., 'memory': ...} or similar dict
        text = item.get("memory") or item.get("text") or str(item)
        if text and text.strip():
            extracted_lines.append(f"- {text.strip()}")
            clean_memories.append({
                "id": str(item.get("id") or ""),
                "memory": text.strip(),
                "score": float(item["score"]) if item.get("score") is not None else None
            })

    if not extracted_lines:
        return [], ""

    logger.info("Successfully recalled %d relevant memories for query '%s'", len(clean_memories), query)
    bullet_points = "\n".join(extracted_lines)

    # Natural context framing for recalled memories to avoid triggering false safety auditor modes
    prompt_context = (
        "\n\n【用户相关历史记忆】\n"
        "（以下是系统检索到的与用户相关的历史事实与偏好信息，仅供回答时作为参考）：\n"
        f"{bullet_points}\n"
    )

    return clean_memories, prompt_context
