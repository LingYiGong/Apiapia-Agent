import json
import math
import time
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from app.services.memory.service import memory_service
from app.services.prompt.localized import text

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

MAX_MEMORY_CONTEXT_CHARS = 4800
MAX_PROFILE_ITEMS = 5
MAX_RELEVANT_ITEMS = 5

# Cache for user profile memories to avoid redundant full-table queries per chat turn
_profile_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
PROFILE_CACHE_TTL = 60.0  # seconds


def _get_cached_profile_memories(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve stable profile memories with short in-memory cache to save database scans."""
    now = time.time()
    if user_id in _profile_cache:
        ts, cached = _profile_cache[user_id]
        if now - ts < PROFILE_CACHE_TTL:
            return list(cached)

    profile_memories: List[Dict[str, Any]] = []
    try:
        for item in memory_service.list_memories(user_id=user_id, limit=50):
            meta = item.get("metadata") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            if meta.get("type") == "profile":
                profile_memories.append(item)
    except Exception as profile_err:
        logger.debug("Profile memory lookup failed: %s", profile_err)

    _profile_cache[user_id] = (now, profile_memories)
    return list(profile_memories)


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
    Compute bounded recency weight in range [0.65, 1.0].
    High-importance memories (≥4) have λ=0 and therefore never decay.
    For other memories, exponential decay gives fresh memories a bonus up to 1.0,
    while a floor of 0.65 prevents artificial amnesia for older, highly-relevant facts.
    """
    lam = _LAMBDA_BY_IMPORTANCE.get(importance, _LAMBDA_DEFAULT)
    if lam == 0.0:
        return 1.0  # permanent — no decay

    if not created_at_str:
        return 0.85  # neutral fallback

    try:
        ts = str(created_at_str).replace("Z", "+00:00")
        created_at = datetime.fromisoformat(ts)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        days_ago = max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds() / 86400)
        return 0.65 + 0.35 * math.exp(-lam * days_ago)
    except Exception:
        return 0.85


def _compute_final_score(item: Dict[str, Any], parsed_metadata: Dict) -> float:
    """
    final_score = semantic_score × recency_weight(importance)

    semantic_score  — cosine similarity from pgvector, range [0, 1]
    recency_weight  — exponential decay based on age and importance
    """
    semantic = float(item.get("score") or 0.5)
    importance = _parse_importance(parsed_metadata)

    # An updated fact is fresh again. Prefer the update timestamp; otherwise
    # replacing an old preference would leave it permanently decayed.
    created_at = (
        item.get("updated_at")
        or (parsed_metadata.get("updated_at") if parsed_metadata else None)
        or item.get("created_at")
        or (parsed_metadata.get("created_at") if parsed_metadata else None)
    )
    recency = _recency_weight(created_at, importance)

    return semantic * recency


def enrich_query_with_conversation_context(
    query: str,
    recent_msgs: List[Any],
    max_context_chars: int = 120,
) -> str:
    """
    In multi-turn chat, queries often use pronouns ('它', '那个', '之前的方案')
    or short continuation phrases ('继续', '推荐点好吃的').
    Enrich the query with key subjects from the recent conversation turn so that
    vector similarity search can match relevant long-term facts.
    """
    import re
    clean_q = (query or "").strip()
    if not clean_q or not recent_msgs:
        return clean_q

    # Pronoun & continuation markers indicating dependency on previous context across locales
    context_dependent_patterns = (
        # Simplified Chinese
        "它", "他", "她", "其", "这", "那", "之前", "刚才", "上次", "接着", "继续",
        "还有呢", "推荐", "怎么弄", "哪个好", "评价一下", "那个", "这个", "它们",
        # Traditional Chinese
        "這", "那", "剛才", "接著", "繼續", "還有呢", "推薦", "哪個好", "評價一下", "那個", "這個", "它們",
        # English
        "it", "they", "them", "this", "that", "these", "those", "continue", "previous", "earlier",
        "recommend", "what about", "how about", "which one",
        # Japanese
        "それ", "これ", "あれ", "彼", "彼女", "前回", "さっき", "続き", "おすすめ", "どう", "どれ",
    )

    is_short = len(clean_q) <= 25
    has_dependent_marker = any(marker in clean_q for marker in context_dependent_patterns)

    if not (is_short or has_dependent_marker):
        return clean_q

    # Extract the most recent message anchor from recent_msgs
    context_anchor = ""
    for m in reversed(recent_msgs):
        m_role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "")
        m_content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
        if not m_content:
            continue
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", str(m_content))
        cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
        cleaned = re.sub(r"!\[.*?\]\(.*?\)", "", cleaned)
        cleaned = re.sub(r"\[.*?\]\(.*?\)", "", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned:
            context_anchor = cleaned[:max_context_chars]
            break

    if context_anchor:
        return f"{context_anchor} {clean_q}"

    return clean_q


def should_retrieve_memories(query: str) -> bool:
    """Cheap gate to avoid a vector lookup for clearly generic questions."""
    text_val = (query or "").strip().lower()
    if not text_val:
        return False
    # Explicitly generic, self-contained requests normally gain nothing from
    # personal memory (translation, syntax, arithmetic, etc.), unless explicitly
    # asking to adapt to personal preferences or style, or referring to the user.
    generic_markers = (
        # Simplified Chinese
        "翻译", "怎么写", "语法", "定义",
        # Traditional Chinese
        "翻譯", "怎麼寫", "語法",
        # English
        "translate", "how to write", "syntax", "grammar", "definition", "what is",
        # Japanese
        "翻訳", "書き方", "文法", "構文", "定義", "とは",
    )
    preference_override_markers = (
        # Simplified Chinese
        "我", "我的", "我们", "自己", "我之前", "按我", "根据我", "适合我", "推荐我", "偏好", "习惯", "风格", "记得",
        # Traditional Chinese
        "我的", "我們", "我之前", "按我", "根據我", "適合我", "推薦我", "習慣", "風格", "記得",
        # English
        "my", "mine", "our", "me", "myself", "preference", "prefer", "habit", "style", "remember",
        # Japanese
        "私", "僕", "俺", "自分", "好み", "習慣", "以前", "おすすめ", "私の", "覚えて",
    )
    if any(marker in text_val for marker in generic_markers):
        if not any(pref in text_val for pref in preference_override_markers):
            return False

    personal_markers = (
        # Simplified Chinese
        "我", "我的", "我之前", "记得", "偏好", "喜欢", "不喜欢", "习惯", "计划", "项目", "推荐", "适合我", "根据我的",
        # Traditional Chinese
        "記得", "喜歡", "不喜歡", "習慣", "計劃", "專案", "推薦", "適合我", "根據我的",
        # English
        "my ", " i ", "remember", "prefer", "preference", "like", "dislike", "habit", "project", "plan", "recommend",
        # Japanese
        "私", "僕", "俺", "好き", "嫌い", "好み", "おすすめ", "自分", "プロジェクト", "計画", "覚えて",
    )
    # Questions framed around personal context should always use memory.
    if any(marker in text_val for marker in personal_markers):
        return True
    # Ambiguous requests are worth a lookup; this keeps recall conservative.
    return True


# ── Main retrieval function ───────────────────────────────────────────────────

def retrieve_relevant_memories(
    user_id: str,
    query: str,
    limit: int = 5,
    score_threshold: float = 0.0,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Retrieve and rerank relevant memories using a composite score:
        final_score = semantic_score × recency_weight(importance)
    Synchronously filters items by score_threshold so returned clean memories
    and formatted prompt context are strictly aligned.
    """
    search_query = query.strip()
    # Guard against OpenAI embedding 8192 token limit error on long queries
    if len(search_query) > 2000:
        search_query = search_query[:2000]

    logger.info(
        "Searching relevant memories for user %s (query: '%.60s', threshold=%.2f)",
        user_id, search_query, score_threshold
    )

    profile_memories: List[Dict[str, Any]] = []
    try:
        # Stable profile facts (identity, durable preferences) using short-TTL cache
        profile_memories = _get_cached_profile_memories(user_id)

        # Fetch 2× limit so reranking has enough candidates to choose from
        raw_memories = memory_service.search_memory(
            user_id=user_id, query=search_query, limit=limit * 2
        )
    except Exception as e:
        logger.warning("Failed to retrieve memories for user %s: %s", user_id, str(e))
        return [], ""

    if not raw_memories and not profile_memories:
        logger.info("No memories matched query for user %s", user_id)
        return [], ""
    raw_memories = raw_memories or []

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
        # Apply score threshold filter to semantic results if score_threshold > 0
        if score_threshold > 0.0 and final < score_threshold:
            continue

        scored.append({
            **item,
            "_parsed_meta": meta,
            "_final_score": final,
            "_semantic_score": float(item.get("score") or 0.5),
        })

    scored.sort(key=lambda x: x["_final_score"], reverse=True)
    top = scored[:limit]

    # Add a small, stable profile block ahead of semantic results. De-duplicate
    # by id so a profile item returned by vector search is not shown twice.
    selected_ids = {str(item.get("id") or "") for item in top}
    for profile in reversed(profile_memories[:MAX_PROFILE_ITEMS]):
        if str(profile.get("id") or "") not in selected_ids:
            profile_meta = profile.get("metadata") or {}
            if isinstance(profile_meta, str):
                try:
                    profile_meta = json.loads(profile_meta)
                except Exception:
                    profile_meta = {}
            top.insert(0, {
                **profile,
                "_parsed_meta": profile_meta,
                "_final_score": 1.0,
                "_semantic_score": 1.0,
            })

    # ── Format output ─────────────────────────────────────────────────────────
    profile_lines: List[str] = []
    relevant_lines: List[str] = []
    clean_memories: List[Dict[str, Any]] = []
    seen_ids = set()
    profile_count = 0
    relevant_count = 0
    chars_used = 0

    for item in top:
        mem_text = item.get("memory") or item.get("text") or str(item)
        if not (mem_text and mem_text.strip()):
            continue

        meta = item.get("_parsed_meta", {})
        importance = _parse_importance(meta)
        memory_id = str(item.get("id") or "")
        if memory_id and memory_id in seen_ids:
            continue
        if memory_id:
            seen_ids.add(memory_id)
        mem_text = mem_text.strip()[:1200]
        line = f"- {mem_text}"
        is_profile = meta.get("type") == "profile"
        if is_profile and profile_count >= MAX_PROFILE_ITEMS:
            continue
        if not is_profile and relevant_count >= MAX_RELEVANT_ITEMS:
            continue
        if chars_used + len(line) + 1 > MAX_MEMORY_CONTEXT_CHARS:
            continue
        if is_profile:
            profile_lines.append(line)
            profile_count += 1
        else:
            relevant_lines.append(line)
            relevant_count += 1
        chars_used += len(line) + 1
        clean_memories.append({
            "id": memory_id,
            "memory": mem_text,
            "score": round(item["_final_score"], 4),
            "semantic_score": round(item["_semantic_score"], 4),
            "importance": importance or None,
            "type": meta.get("type") or "fact",
        })

    if not clean_memories:
        return [], ""

    logger.info(
        "Recalled %d memories (filtered by threshold >= %.2f) for query '%.60s'",
        len(clean_memories), score_threshold, query,
    )

    sections = [
        "<user_memory>",
        text("memory_header"),
        text("memory_rule_1"),
        text("memory_rule_2"),
        text("memory_rule_3"),
    ]
    if profile_lines:
        sections.extend(["<stable_profile>", *profile_lines, "</stable_profile>"])
    if relevant_lines:
        sections.extend(["<relevant_memories>", *relevant_lines, "</relevant_memories>"])
    sections.append("</user_memory>")
    prompt_context = "\n\n" + "\n".join(sections) + "\n"

    return clean_memories, prompt_context
