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
    """Return (OpenAI-compatible client, resolved_model) with connection caching."""
    try:
        from openai import OpenAI

        credential = resolve_memory_credential(memory_model)
        model = credential["llm_model"]
        if not credential["available"]:
            return None, model

        cache_key = (credential["api_key"], credential["base_url"] or "")
        if cache_key not in _client_cache:
            _client_cache[cache_key] = OpenAI(
                api_key=credential["api_key"],
                base_url=credential["base_url"],
                timeout=60.0,
            )

        return _client_cache[cache_key], model

    except ImportError:
        logger.warning("openai package not installed; cannot run smart extraction.")

    return None, memory_model


def _repair_truncated_json(s: str) -> Optional[str]:
    """Attempt to repair a JSON string that was truncated due to token limits."""
    idx = max(s.rfind(","), s.rfind("}"), s.rfind("]"))
    if idx <= 0:
        return None
    sub = s[:idx].rstrip(",")

    stack = []
    in_string = False
    escape = False
    for ch in sub:
        if ch == '"' and not escape:
            in_string = not in_string
        elif not in_string:
            if ch in ("{", "["):
                stack.append(ch)
            elif ch == "}" and stack and stack[-1] == "{":
                stack.pop()
            elif ch == "]" and stack and stack[-1] == "[":
                stack.pop()
        if ch == "\\" and not escape:
            escape = True
        else:
            escape = False

    if in_string:
        sub += '"'

    while stack:
        opener = stack.pop()
        if opener == "{":
            sub += "}"
        elif opener == "[":
            sub += "]"

    return sub


def _parse_json_from_text(raw_content: str) -> Optional[Dict[str, Any]]:
    """Robustly extract and parse a JSON dictionary from LLM output."""
    if not raw_content or not raw_content.strip():
        return None

    # Strip reasoning tags <think>...</think>
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw_content).strip()
    if "<think>" in cleaned:
        cleaned = re.sub(r"<think>[\s\S]*", "", cleaned).strip()

    candidates = []

    # 1. Look for markdown code fence anywhere: ```(?:json)? ... ```
    fence_matches = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, flags=re.IGNORECASE)
    for f in fence_matches:
        f_str = f.strip()
        if "{" in f_str:
            candidates.append(f_str)

    # 2. Regex search for outermost {...}
    outer_match = re.search(r"(\{[\s\S]*\})", cleaned)
    if outer_match:
        candidates.append(outer_match.group(1).strip())

    # 3. Whole cleaned string
    candidates.append(cleaned)

    for c in candidates:
        if not c:
            continue

        # Pass 1: Direct JSON parse with strict=False (allows unescaped control chars / newlines)
        try:
            parsed = json.loads(c, strict=False)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # Pass 2: Remove trailing commas before } or ]
        fixed_commas = re.sub(r",\s*([\]\}])", r"\1", c)
        try:
            parsed = json.loads(fixed_commas, strict=False)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # Pass 3: Repair truncated JSON (unclosed brackets/curlies)
        repaired = _repair_truncated_json(fixed_commas)
        if repaired:
            try:
                parsed = json.loads(repaired, strict=False)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

        # Pass 4: ast.literal_eval fallback for Python dict formatted output
        try:
            import ast
            parsed = ast.literal_eval(c)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    return None


def safe_json_chat_completion(
    client: Any,
    model: str,
    prompt: str,
    temperature: float = 0.0,
    max_tokens: int = 4096,
    seed: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """
    Robust chat completion helper for JSON responses:
    1. Injects explicit system prompt enforcing raw JSON output.
    2. Bypasses unsupported response_format on free models to avoid wasted 400 retries.
    3. Gracefully captures reasoning_content if content is empty.
    4. Parses JSON with trailing-comma, unescaped-newlines, code-fence, and truncation recovery.
    """
    system_msg = (
        "You are a strict JSON data processing engine. "
        "You must output ONLY a valid JSON object matching the requested schema. "
        "Do NOT output markdown fences (```json), thinking tags, preamble, conversational text, or explanation."
    )
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": prompt},
    ]

    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if seed is not None:
        kwargs["seed"] = seed

    # Models ending with :free or openrouter/free usually reject response_format and return HTTP 400.
    supports_response_format = not (":free" in model.lower() or "openrouter/free" in model.lower())

    raw_content = ""
    try:
        if supports_response_format:
            try:
                resp = client.chat.completions.create(
                    **kwargs,
                    response_format={"type": "json_object"},
                )
                choice = resp.choices[0]
                raw_content = choice.message.content or ""
                reasoning = getattr(choice.message, "reasoning_content", None) or getattr(choice.message, "reasoning", None) or ""
                if not raw_content.strip() and reasoning.strip():
                    raw_content = reasoning
            except Exception as rf_err:
                logger.debug("Model %s rejected response_format: %s. Retrying standard completion.", model, rf_err)
                resp = client.chat.completions.create(**kwargs)
                choice = resp.choices[0]
                raw_content = choice.message.content or ""
                reasoning = getattr(choice.message, "reasoning_content", None) or getattr(choice.message, "reasoning", None) or ""
                if not raw_content.strip() and reasoning.strip():
                    raw_content = reasoning
        else:
            resp = client.chat.completions.create(**kwargs)
            choice = resp.choices[0]
            raw_content = choice.message.content or ""
            reasoning = getattr(choice.message, "reasoning_content", None) or getattr(choice.message, "reasoning", None) or ""
            if not raw_content.strip() and reasoning.strip():
                raw_content = reasoning
    except Exception as e:
        logger.warning("LLM completion failed for model %s: %s", model, e)
        return None

    parsed = _parse_json_from_text(raw_content)
    if parsed:
        return parsed

    logger.warning("Failed to parse JSON response from model %s: '%.120s'", model, raw_content)
    return None


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

    data = safe_json_chat_completion(
        client=client,
        model=model,
        prompt=prompt,
        temperature=0.1,
        max_tokens=800,
    )
    if not data or not isinstance(data, dict):
        return []

    facts = data.get("facts", [])
    if isinstance(facts, list):
        logger.info("Extracted %d raw facts from conversation", len(facts))
        return facts
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

    data = safe_json_chat_completion(
        client=client,
        model=model,
        prompt=prompt,
        temperature=0.0,
        max_tokens=300,
    )
    if not data or not isinstance(data, dict):
        return "ADD", new_fact

    decision = str(data.get("decision", "ADD")).upper()
    merged = data.get("merged_text") or new_fact
    if decision not in ("KEEP_NEW", "MERGE", "IGNORE", "ADD"):
        decision = "ADD"
    return decision, merged


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
    """Run extraction on the executor so the caller's event loop keeps moving."""
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        None, smart_extract_memories_task, user_id, messages, metadata, memory_model
    )
