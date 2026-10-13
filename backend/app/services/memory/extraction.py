import re
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

from app.core.i18n import get_locale, language_directive
from app.services.memory.service import memory_service
from app.services.memory.credentials import resolve_memory_credential
from app.services.prompt.localized import memory_text

logger = logging.getLogger("memory_extraction")

# ── Tunable constants ──────────────────────────────────────────────────────────
IMPORTANCE_THRESHOLD = 2        # facts scored below this are discarded
DEDUP_SIMILARITY_THRESHOLD = 0.88  # cosine similarity above which we consider two memories "same topic"


# ── LLM client helper with connection reuse ──────────────────────────────────
_client_cache: Dict[Tuple[str, str], Any] = {}

def _get_llm_client(memory_model: str = "gpt-4o-mini") -> Tuple[Optional[Any], str]:
    """
    Return (OpenAI-compatible client, resolved_model).

    Credentials come from the shared resolver so this path and the Mem0 config in
    service.py cannot disagree about which endpoint a model name belongs to — they
    used to, and a bare ``gpt-4o-mini`` would extract fine and then fail to store.

    The client is cached to keep HTTP connection pooling; OpenAI keys are long
    lived and few, so the cache cannot grow without bound in practice.
    """
    try:
        from openai import OpenAI

        credential = resolve_memory_credential(memory_model)
        model = credential["llm_model"]
        if not credential["available"]:
            return None, model

        cache_key = (credential["api_key"], credential["base_url"] or "")
        if cache_key not in _client_cache:
            _client_cache[cache_key] = OpenAI(
                api_key=credential["api_key"], base_url=credential["base_url"]
            )

        return _client_cache[cache_key], model

    except ImportError:
        logger.warning("openai package not installed; cannot run smart extraction.")

    return None, memory_model


# ── Phase 1: Importance-scored fact extraction ────────────────────────────────

def _extract_facts_with_importance(
    messages: List[Dict[str, str]],
    memory_model: str = "gpt-4o-mini"
) -> List[Dict[str, Any]]:
    """
    Use LLM to extract facts about the USER from the conversation,
    each annotated with an importance score (1-5).

    Importance scale:
      5 = Core identity (name, occupation, city, long-term goals)
      4 = Strong preference / habit (explicitly stated likes / dislikes)
      3 = Useful background (skills, interests, current projects)
      2 = Short-term state (temporary activities, one-off events)
      1 = Noise (small talk, greetings — not worth storing)
    """
    client, model = _get_llm_client(memory_model)
    if not client:
        return []

    conv_text = "\n".join(
        f"{m.get('role', 'user').upper()}: {m.get('content', '')}"
        for m in messages
    )

    subject = memory_text("subject")
    fact_length = memory_text("fact_length")

    # 记忆文本会被原样注入之后每一次对话的上下文。语言一旦在这里
    # 混进去，后面就再也分不出来了 —— 用户说英文、模型写中文主语，
    # 于是英文对话的上下文里一直挂着几条中文记忆。所以措辞的语言
    # 必须显式钉死，而不是指望模型跟着对话内容走。
    #
    # 只对需要替换的片段用 f-string：整块字符串再走一次 .format() 的话，
    # 语言指令里任何 { } 都会被当成占位符解析。
    prompt = (
        language_directive(get_locale())
        + "\n\n"
        + f"从以下对话中提取关于「{subject}」本人的关键事实和偏好"
        "（不包括助理说的内容、建议或分析）。\n\n"
        "重要性等级（1-5）：\n"
        "5 = 核心身份信息（姓名、职业、所在城市、长期目标或计划）\n"
        "4 = 强烈偏好或习惯（明确表达的喜好、厌恶、行为习惯）\n"
        "3 = 有用背景信息（技能、兴趣爱好、当前项目、正在学习的内容）\n"
        "2 = 短期状态（临时性活动、一次性事件，信息可能很快过期）\n"
        "1 = 噪音（随意闲聊、打招呼、无实质记忆价值的内容）\n\n"
        "要求：\n"
        + f"- 每条事实用简洁的陈述句（{fact_length}），主语为「{subject}」\n"
        + f"- 只记录{subject}「自己」表达的信息，不包括助理的推断\n"
        "- 若对话中没有值得记录的事实，facts 返回空列表\n\n"
        "返回纯 JSON（不要包含任何 markdown 格式）：\n"
        '{"facts": [{"text": "事实内容", "importance": 3}]}\n\n'
        "对话内容：\n"
        + conv_text
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=800,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        facts = data.get("facts", [])
        logger.info("Extracted %d raw facts from conversation", len(facts))
        return facts
    except Exception as e:
        logger.warning("Failed to extract facts with importance: %s", e)
        return []


# ── Phase 2: Dedup / merge decision ──────────────────────────────────────────

def _decide_dedup(
    new_fact: str,
    existing_memory: str,
    memory_model: str = "gpt-4o-mini"
) -> Tuple[str, str]:
    """
    Ask LLM whether a new fact conflicts with / duplicates an existing memory.

    Returns (decision, text_to_use):
      KEEP_NEW  → replace old with new_fact
      MERGE     → replace old with merged_text (returned in 2nd element)
      IGNORE    → keep old, discard new_fact
      ADD       → both are different facts; add new_fact without touching old
    """
    client, model = _get_llm_client(memory_model)
    if not client:
        return "ADD", new_fact

    prompt = (
        "判断以下两条关于同一用户的记忆是否指向同一事实，并决定如何处理。\n\n"
        f"新记忆：{new_fact}\n"
        f"现有记忆：{existing_memory}\n\n"
        "选项说明：\n"
        "- KEEP_NEW  ：新记忆更准确或更新（例如状态已发生变化），应替换旧记忆\n"
        "- MERGE     ：两者信息互补，合并为一条更完整的记忆（在 merged_text 给出合并结果）\n"
        "- IGNORE    ：现有记忆已足够准确，新记忆不带来新增信息，丢弃新记忆\n"
        "- ADD       ：两者描述不同事实，不存在冲突，都应保留\n\n"
        "返回纯 JSON：\n"
        '{"decision": "KEEP_NEW", "merged_text": ""}'
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=300,
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        decision = str(data.get("decision", "ADD")).upper()
        merged = data.get("merged_text") or new_fact
        if decision not in ("KEEP_NEW", "MERGE", "IGNORE", "ADD"):
            decision = "ADD"
        return decision, merged
    except Exception as e:
        logger.warning("Failed to decide dedup (defaulting to ADD): %s", e)
        return "ADD", new_fact


# ── Shared helper: add a single vetted fact string to Mem0 ────────────────────

def _add_single_fact(
    user_id: str,
    fact_text: str,
    importance: int,
    meta_base: Dict[str, Any],
    memory_model: str,
):
    """Add a single pre-vetted fact string to Mem0 with importance in metadata."""
    if "type" not in meta_base:
        meta_base = {
            **meta_base,
            "type": "profile" if importance >= 4 else ("temporary" if importance == 2 else "fact"),
        }
    meta = {
        **meta_base,
        "importance": importance,
        "confidence": float(meta_base.get("confidence", 0.7)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        memory_service.add_memory(
            user_id=user_id,
            data=fact_text,
            metadata=meta,
            memory_model=memory_model,
        )
        logger.info(
            "Stored new memory for user %s (importance=%d): '%s'",
            user_id, importance, fact_text[:70],
        )
    except Exception as e:
        logger.warning("Failed to add memory for user %s: %s", user_id, e)


# ── Shared Fact Dedup & Upsert Pipeline ──────────────────────────────────────

def upsert_facts_to_memory(
    user_id: str,
    raw_facts: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None,
    memory_model: Optional[str] = None,
    min_importance: int = IMPORTANCE_THRESHOLD,
) -> int:
    """
    Dedup and upsert a list of candidate facts/summaries with importance scores into Mem0.
    Shared pipeline used by both single-turn smart extraction and macro-level dreaming.
    Returns the count of successfully processed facts.
    """
    if not raw_facts:
        return 0

    resolved_model = memory_model or "gpt-4o-mini"
    important_facts = [
        f for f in raw_facts
        if isinstance(f.get("importance"), (int, float)) and f["importance"] >= min_importance
    ]
    logger.info(
        "user %s: %d/%d facts passed importance filter (threshold=%d)",
        user_id, len(important_facts), len(raw_facts), min_importance,
    )
    if not important_facts:
        return 0

    meta_base = (metadata or {}).copy()
    if "evidence" not in meta_base:
        source_messages = meta_base.pop("source_messages", []) or []
        meta_base["evidence"] = "\n".join(
            str(m.get("content", "")).strip()
            for m in source_messages
            if m.get("role") == "user" and str(m.get("content", "")).strip()
        )[:2000]
    else:
        meta_base.pop("source_messages", None)
    processed_count = 0

    for fact in important_facts:
        fact_text = (fact.get("text") or "").strip()
        importance = int(fact.get("importance", 3))
        if not fact_text:
            continue

        # Dedup search in Mem0
        try:
            similar = memory_service.search_memory(
                user_id=user_id, query=fact_text, limit=3
            )
        except Exception as e:
            logger.warning("Dedup search failed for user %s, proceeding with ADD: %s", user_id, e)
            similar = []

        high_sim = [
            m for m in similar
            if isinstance(m.get("score"), float) and m["score"] >= DEDUP_SIMILARITY_THRESHOLD
        ]

        if high_sim:
            existing = high_sim[0]
            existing_id = str(existing.get("id") or "")
            existing_text = existing.get("memory") or ""

            decision, merged_text = _decide_dedup(fact_text, existing_text, memory_model=resolved_model)
            logger.info(
                "Dedup [%s] for user %s | new='%.40s' | old='%.40s'",
                decision, user_id, fact_text, existing_text,
            )

            if decision == "IGNORE":
                continue

            if decision in ("KEEP_NEW", "MERGE") and existing_id:
                final_text = merged_text if decision == "MERGE" else fact_text
                try:
                    memory_service.update_memory(
                        user_id=user_id,
                        memory_id=existing_id,
                        data=final_text,
                        metadata={
                            **meta_base,
                            "importance": importance,
                            "confidence": float(fact.get("confidence", 0.7)),
                        },
                    )
                    logger.info("Updated memory %s for user %s (%s)", existing_id, user_id, decision)
                    processed_count += 1
                    continue
                except Exception as e:
                    logger.warning(
                        "Failed to update memory %s (%s) — falling back to ADD: %s",
                        existing_id, decision, e,
                    )

            _add_single_fact(user_id, fact_text, importance, meta_base, resolved_model)
            processed_count += 1
        else:
            _add_single_fact(user_id, fact_text, importance, meta_base, resolved_model)
            processed_count += 1

    return processed_count


# ── Core smart extraction task ────────────────────────────────────────────────

def smart_extract_memories_task(
    user_id: str,
    messages: List[Dict[str, str]],
    metadata: Optional[Dict[str, Any]] = None,
    memory_model: Optional[str] = None,
):
    """
    4-step smart memory extraction pipeline:
    1. LLM extracts facts from the conversation WITH importance scores (Phase 1)
    2. Delegate deduplication & storage to unified upsert_facts_to_memory
    """
    if not memory_service.is_configured():
        logger.debug("Skipping smart extraction for user %s: no API key configured.", user_id)
        return

    resolved_model = memory_model or "gpt-4o-mini"
    sanitized = sanitize_messages_for_memory(messages)
    if not sanitized:
        logger.info("No content after sanitizing for user %s — skipping extraction.", user_id)
        return

    facts = _extract_facts_with_importance(sanitized, memory_model=resolved_model)
    if not facts:
        logger.info("No facts extracted for user %s.", user_id)
        return

    upsert_facts_to_memory(
        user_id=user_id,
        raw_facts=facts,
        metadata=metadata,
        memory_model=resolved_model,
        min_importance=IMPORTANCE_THRESHOLD,
    )


# ── Message sanitization (unchanged from v1) ──────────────────────────────────

def sanitize_messages_for_memory(
    messages: List[Dict[str, str]],
    max_total_chars: int = 5000,
) -> List[Dict[str, str]]:
    """
    Sanitize and truncate messages before processing:
    1. Strip <think>...</think> reasoning scratchpad (e.g. DeepSeek R1)
    2. Limit character length to prevent OpenAI embedding 8192 token overflow.
    """
    if not messages:
        return []

    cleaned = []
    max_per_msg = max(1000, max_total_chars // max(1, len(messages)))

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "") or ""

        if "<think>" in content:
            content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()

        if len(content) > max_per_msg:
            content = content[:max_per_msg] + "... [内容已截断]"

        if content.strip():
            cleaned.append({"role": role, "content": content})

    return cleaned


# ── Public API ────────────────────────────────────────────────────────────────

async def schedule_memory_extraction(
    user_id: str,
    messages: List[Dict[str, str]],
    metadata: Optional[Dict[str, Any]] = None,
    memory_model: Optional[str] = None,
):
    """Run extraction on the executor so the caller's event loop keeps moving.

    This used to go through an ``extract_memories_task`` wrapper whose only body was
    a call to ``smart_extract_memories_task``; the wrapper existed to keep a v1
    signature alive and nothing outside this module imported it.
    """
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        None, smart_extract_memories_task, user_id, messages, metadata, memory_model
    )
