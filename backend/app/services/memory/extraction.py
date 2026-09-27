import logging
import asyncio
from typing import List, Dict, Any
from app.services.memory.service import memory_service

logger = logging.getLogger("memory_extraction")


def extract_memories_task(
    user_id: str,
    messages: List[Dict[str, str]],
    metadata: Dict[str, Any] = None,
    memory_model: str = None
):
    """
    Background worker task to extract and persist long-term memories using Mem0 OSS.
    Runs asynchronously and non-blocking after SSE streaming finishes.
    
    NOTE ON MEM0 OSS 2.2.1:
    The OSS version uses an ADD-only approach for extracted items.
    """
    if not memory_service.is_configured():
        logger.debug("Skipping memory extraction for user %s: No API key is configured.", user_id)
        return

    try:
        logger.info(
            "Starting background memory extraction for user %s (%d messages, model=%s)",
            user_id,
            len(messages),
            memory_model or "default"
        )
        # Mem0 supports message lists: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        result = memory_service.add_memory(
            user_id=user_id,
            data=messages,
            metadata=metadata or {},
            memory_model=memory_model
        )
        logger.info("Successfully completed memory extraction for user %s: %s", user_id, result)
    except Exception as e:
        logger.error("Error in background memory extraction for user %s: %s", user_id, str(e), exc_info=True)


async def schedule_memory_extraction(
    user_id: str,
    messages: List[Dict[str, str]],
    metadata: Dict[str, Any] = None,
    memory_model: str = None
):
    """Schedule extraction to run on background executor without blocking current coroutine."""
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, extract_memories_task, user_id, messages, metadata, memory_model)
