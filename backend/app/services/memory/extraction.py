import re
import logging
import asyncio
from typing import List, Dict, Any
from app.services.memory.service import memory_service

logger = logging.getLogger("memory_extraction")


def sanitize_messages_for_memory(messages: List[Dict[str, str]], max_total_chars: int = 5000) -> List[Dict[str, str]]:
    """
    Sanitize and truncate messages before sending to Mem0:
    1. Strip <think>...</think> reasoning scratchpad (e.g. DeepSeek R1) so it doesn't pollute memory or exceed embedding limits.
    2. Limit character length to guarantee it never exceeds OpenAI's 8192 embedding token limit.
    """
    if not messages:
        return []

    cleaned = []
    max_per_msg = max(1000, max_total_chars // max(1, len(messages)))

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "") or ""

        # Remove <think>...</think> internal reasoning
        if "<think>" in content:
            content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()

        # Enforce max length per message to prevent embedding overflow
        if len(content) > max_per_msg:
            content = content[:max_per_msg] + "... [内容已截断]"

        if content.strip():
            cleaned.append({"role": role, "content": content})

    return cleaned


def extract_memories_task(
    user_id: str,
    messages: List[Dict[str, str]],
    metadata: Dict[str, Any] = None,
    memory_model: str = None
):
    """
    Background worker task to extract and persist long-term memories using Mem0 OSS.
    Runs asynchronously and non-blocking after SSE streaming finishes.
    """
    if not memory_service.is_configured():
        logger.debug("Skipping memory extraction for user %s: No API key is configured.", user_id)
        return

    try:
        sanitized_messages = sanitize_messages_for_memory(messages)
        if not sanitized_messages:
            logger.info("No content remaining after sanitizing messages for user %s", user_id)
            return

        logger.info(
            "Starting background memory extraction for user %s (%d messages, model=%s)",
            user_id,
            len(sanitized_messages),
            memory_model or "default"
        )
        result = memory_service.add_memory(
            user_id=user_id,
            data=sanitized_messages,
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
