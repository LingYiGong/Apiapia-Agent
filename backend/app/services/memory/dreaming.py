"""
memory/dreaming.py — ChatGPT-style "Dreaming" background summarisation

Every DREAM_INTERVAL messages in a conversation, a background task analyses
recent conversation history to extract high-level patterns and long-term traits
about the user that may not surface in a single turn's extraction.

Results are written to Mem0 via the same smart extraction pipeline (dedup +
importance scoring) used by extraction.py, so no duplicate memories are created.
"""

import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.core.i18n import get_locale, language_directive
from app.services.prompt.localized import memory_text

logger = logging.getLogger("memory_dreaming")

# ── Constants ──────────────────────────────────────────────────────────────────
DREAM_INTERVAL = 20        # trigger dreaming every N messages in a conversation
DREAM_MAX_CHARS = 600      # max chars per message fed to the dreaming prompt
DREAM_IMPORTANCE_THRESHOLD = 2   # same as extraction.py


# ── Helpers ───────────────────────────────────────────────────────────────────

def should_run_dreaming(total_message_count: int) -> bool:
    """Return True when the conversation has just hit a multiple of DREAM_INTERVAL."""
    return total_message_count > 0 and (total_message_count % DREAM_INTERVAL == 0)


def _build_dreaming_context(messages: List[Dict[str, Any]]) -> str:
    """Trim and format conversation messages for the dreaming prompt."""
    lines = []
    for m in messages:
        role = m.get("role", "user")
        if role not in ("user", "assistant"):
            continue
        content = (m.get("content") or "").strip()
        if not content:
            continue
        # Truncate individual messages to keep prompt manageable
        if len(content) > DREAM_MAX_CHARS:
            content = content[:DREAM_MAX_CHARS] + "…"
        lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines)


# ── Core dreaming task ─────────────────────────────────────────────────────────

def run_dreaming_task(
    user_id: str,
    conv_id: str,
    messages: List[Dict[str, Any]],
    memory_model: Optional[str] = None,
):
    """
    Analyse conversation history and extract macro-level user traits.

    Unlike per-turn extraction (which focuses on explicit facts stated in a
    single turn), dreaming looks at the entire conversation arc and surfaces:
      - Recurring themes and interests
      - Consistent communication style or preferences
      - Patterns that only become visible across multiple turns
      - Long-term goals mentioned in passing across several messages

    Outputs are stored via the same dedup pipeline as smart_extract_memories_task
    to avoid creating contradictory memories.
    """
    from app.services.memory.service import memory_service
    from app.services.memory.extraction import (
        _get_llm_client,
        safe_json_chat_completion,
        upsert_facts_to_memory,
    )

    if not memory_service.is_configured():
        logger.debug("Dreaming skipped for user %s: no API key configured.", user_id)
        return

    if not messages:
        logger.debug("Dreaming skipped for user %s: no messages provided.", user_id)
        return

    resolved_model = memory_model or "gpt-4o-mini"
    client, model = _get_llm_client(resolved_model)
    if not client:
        logger.warning("Dreaming skipped for user %s: LLM client unavailable.", user_id)
        return

    conv_context = _build_dreaming_context(messages)
    if not conv_context.strip():
        return

    logger.info(
        "Running dreaming for user %s, conv %s (%d messages, model=%s)",
        user_id, conv_id, len(messages), resolved_model,
    )

    subject = memory_text("subject")
    summary_length = memory_text("summary_length")

    prompt = (
        language_directive(get_locale())
        + "\n\n"
        + "你是一个专注于用户画像的记忆分析助理。\n"
        "请分析以下对话历史，从「宏观视角」总结关于「" + subject + "」的深层特征，\n"
        "重点关注跨越多轮对话反复出现的模式，而不是逐句提取事实。\n\n"
        "分析角度：\n"
        + f"- {subject}整体是什么样的人？有哪些核心身份特征？\n"
        + f"- {subject}反复表现出哪些兴趣、关切或偏好？\n"
        + f"- {subject}的思维方式、沟通风格或行为习惯有何特点？\n"
        + f"- 哪些长期目标或计划在对话中多次被提及？\n\n"
        "重要性等级（1-5）：\n"
        "5 = 跨多轮都一致的核心身份特征\n"
        "4 = 反复出现的强烈偏好或习惯\n"
        "3 = 有意义的背景模式\n"
        "2 = 仅出现一两次的次要信息\n"
        "1 = 不值得长期记录的内容\n\n"
        "要求：\n"
        + f"- 每条总结是完整陈述句，主语为「{subject}」（{summary_length}）\n"
        "- 重点关注能跨会话持续有用的信息\n"
        "- 若没有值得总结的内容，summaries 返回空列表\n\n"
        "返回纯 JSON：\n"
        '{"summaries": [{"text": "总结内容", "importance": 4}]}\n\n'
        "对话历史：\n"
        + conv_context
    )

    data = safe_json_chat_completion(
        client=client,
        model=model,
        prompt=prompt,
        temperature=0.2,
        max_tokens=1200,
    )
    if not data or not isinstance(data, dict):
        logger.info("Dreaming: no valid JSON returned for user %s conv %s", user_id, conv_id)
        return
    summaries = data.get("summaries", [])

    if not summaries:
        logger.info("Dreaming: no summaries generated for user %s conv %s", user_id, conv_id)
        return

    meta_base = {
        "source": "dreaming",
        "type": "summary",
        "conversation_id": str(conv_id),
        "dreamed_at": datetime.now(timezone.utc).isoformat(),
    }

    count = upsert_facts_to_memory(
        user_id=user_id,
        raw_facts=summaries,
        metadata=meta_base,
        memory_model=resolved_model,
        min_importance=DREAM_IMPORTANCE_THRESHOLD,
    )
    logger.info("Dreaming complete for user %s conv %s: %d summaries processed", user_id, conv_id, count)


# ── Public API ─────────────────────────────────────────────────────────────────

async def schedule_dreaming(
    user_id: str,
    conv_id: str,
    total_message_count: int,
    recent_messages: List[Dict[str, Any]],
    memory_model: Optional[str] = None,
):
    """
    Schedule a dreaming task if the conversation has just crossed a DREAM_INTERVAL
    boundary. Runs non-blocking in a thread-pool executor alongside normal extraction.

    Args:
        user_id:             Authenticated user's ID.
        conv_id:             Current conversation ID.
        total_message_count: Total messages in this conversation AFTER saving the
                             current assistant turn (including it).
        recent_messages:     Recent message dicts {"role", "content"} to analyse.
        memory_model:        LLM model slug for extraction (e.g. "gpt-4o-mini").
    """
    if not should_run_dreaming(total_message_count):
        return

    logger.info(
        "Scheduling dreaming for user %s conv %s (total_messages=%d)",
        user_id, conv_id, total_message_count,
    )
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        None,
        run_dreaming_task,
        user_id,
        conv_id,
        recent_messages,
        memory_model,
    )
