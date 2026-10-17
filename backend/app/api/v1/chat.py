import asyncio
import base64
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings as app_settings
from app.core.errors import ApiError
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.models.setting import UserSetting
from app.schemas.chat import ChatRequest
from app.api.v1.deps import get_current_user
from app.services.catalog import check_user_can_use_model, has_full_model_access
from app.services.model_credentials import resolve_user_llm_credentials
from app.services.llm.factory import get_llm_provider, detect_provider
from app.services.memory.retrieval import retrieve_relevant_memories, should_retrieve_memories
from app.services.memory.extraction import schedule_memory_extraction
from app.services.memory.dreaming import schedule_dreaming
from app.services.document_parser import parse_attachment, fetch_and_parse_url, extract_urls
from app.services.search import (
    web_search_service,
    should_search_web,
    evaluate_and_generate_search_query,
)
from app.services.image_gen import should_generate_image, image_gen_service
from app.services.video_gen import should_generate_video, video_gen_service
from app.services.media_storage import (
    MEDIA_IMAGE_PATH_PREFIX,
    MEDIA_VIDEO_PATH_PREFIX,
    store_generated_image,
    store_generated_video,
    store_uploaded_image,
    media_storage,
)
from app.services.prompt import build_system_prompt
from app.services.deterministic import evaluate_deterministic_context
from app.services.context_manager import (
    sanitize_untrusted_content,
    assemble_quoted_reply_prompt,
    truncate_conversation_history_by_budget,
    apply_prompt_cache_markers,
)

router = APIRouter(prefix="/chat", tags=["chat"])

logger = logging.getLogger("chat_api")

TITLE_GENERATION_PROMPT = (
    "你是一个对话标题生成器。根据用户的第一句提问和助手的回答，"
    "为这段对话拟一个简短准确的中文标题。\n"
    "要求：不超过 20 个字，直接输出标题本身，不要引号、标点结尾、解释或任何前缀。\n\n"
    "用户提问：{user}\n\n助手回答（截断）：{assistant}\n\n标题："
)


async def _generate_conversation_title(
    user_text: str,
    assistant_text: str,
    model: str,
    provider_name: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Ask the same model for a short conversation title.

    Uses the non-streaming ``complete`` path so it cannot interfere with the SSE
    stream, and falls back silently (the truncated first message stays as title).

    ``provider_name`` is passed in rather than re-derived from ``model``: the chat
    request may name a provider explicitly, and re-detecting here could resolve a
    different provider — which would send the caller's credential to the wrong
    endpoint. The caller's own credential is threaded through so titling keeps
    working on models the server itself has no key for.
    """
    provider = get_llm_provider(
        provider=provider_name, model=model, api_key=api_key, base_url=base_url
    )
    prompt = TITLE_GENERATION_PROMPT.format(
        user=(user_text or "")[:500],
        assistant=(assistant_text or "")[:500],
    )
    raw = await provider.complete(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        temperature=0.2,
    )
    if not raw:
        return ""

    title = sanitize_llm_output(str(raw)).strip()
    # Strip common decorations the model may still add. lstrip/rstrip with an
    # explicit character set (rather than a quote-heavy regex) keeps the intent
    # obvious and avoids quoting pitfalls.
    title = title.lstrip(" \t\r\n\"'“”‘’《「『:：-—").rstrip(" \t\r\n\"'“”‘’》」』。，,;；:：")
    title = title.splitlines()[0].strip() if title else ""
    return title if 1 < len(title) <= 40 else ""


def _resolve_image_to_data_url(
    image_id: Optional[str] = None,
    rel_path: Optional[str] = None,
    ext: Optional[str] = None
) -> Optional[str]:
    """Given an image id or relative path from media storage, return data:image/...;base64,..."""
    try:
        target_path = None
        if rel_path:
            target_path = media_storage.resolve(rel_path)
        elif image_id and media_storage.is_valid_image_id(image_id):
            matches = list(media_storage.root.glob(f"images/*/*/{image_id}.*"))
            if matches:
                target_path = matches[0]

        if target_path and target_path.is_file():
            raw_bytes = target_path.read_bytes()
            sniffed_ext = ext or media_storage.sniff_ext(raw_bytes, target_path.suffix.lstrip("."))
            mime = "image/jpeg" if sniffed_ext in ("jpg", "jpeg") else f"image/{sniffed_ext}"
            b64 = base64.b64encode(raw_bytes).decode("utf-8")
            return f"data:{mime};base64,{b64}"
    except Exception as e:
        logger.warning("Failed to resolve image to data URL: %s", e)
    return None


def estimate_token_count(text: str) -> int:
    """Accurately estimate token count for multi-lingual text (Chinese + English)."""
    if not text:
        return 0
    zh_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - zh_chars
    return zh_chars + other_chars // 4


LEAK_TRIGGERS = [
    "<|tool",
    "<|plugin",
    "<|action",
    "<tool",
    "<func",
    "<action",
    "<invoke",
    "<call",
    "<plugin",
    "<code_interpreter",
    "[SEARCH:",
    "[ACTION:",
    "[TOOL:",
    "[google(",
    "[search(",
    "User Safety:",
    "Response Safety:",
    "Input Safety:",
    "Output Safety:",
    "Thus both are safe",
    "Thus all are safe",
    "We must output exactly that format",
    "Safety Assessment:",
    "Content Moderation:",
    "\nUser:",
    "\nHuman:"
]

LEAK_CLOSING = [
    "<|tool_call_end|>",
    "<|tool_calls_end|>",
    "<|im_end|>",
    "</tool_call>",
    "</tool>",
    "</function>",
    "</action>",
    "</invoke>",
    "</call>",
    "</code_interpreter>",
    "</plugin>",
    "]",
    "\n\n"
]


def sanitize_llm_output(text: str) -> str:
    """
    Universal LLM output sanitizer.
    Handles all 4 major classes of non-user leaks across any model:
    1. Unexecuted Agent/Tool calls (<tool...>, <func...>, <action...>, <invoke...>, [ACTION:...])
    2. Guardrail & Content Moderation leaks (User/Response Safety, Safety Assessment, etc.)
    3. Multi-turn role bleeding (model hallucinating next turn User:/Human:)
    4. Internal scratchpad & reflection tags (<scratchpad>, <internal>, etc.)
    """
    if not text:
        return ""
    cleaned = text

    # 1. Strip raw tool/function call containers and dangling arguments
    cleaned = re.sub(
        r'<\/?(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)[\s\S]*?(?:<\/(?:tool(?:_call)?|func(?:tion)?(?:_call)?|action|invoke|plugin_call|code_interpreter|call)>|$)',
        '',
        cleaned,
        flags=re.IGNORECASE
    )
    cleaned = re.sub(r'<\|(?:tool(?:_call|_calls)?_start|action_start|plugin_start)\|?>[\s\S]*?(?:<\|(?:tool(?:_call|_calls)?_end|action_end|plugin_end)\|?>|$)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION|google|search):\s*[^\]]+\]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[(?:google|search)\([^\]]*\)\]', '', cleaned, flags=re.IGNORECASE)

    # 2. Strip ReAct-style leftover traces if present without execution
    cleaned = re.sub(r'\n\s*(?:Action|Action Input|Observation):\s*[\s\S]*?(?=\n\s*(?:Thought|Final Answer)|$)', '', cleaned, flags=re.IGNORECASE)

    # 3. Strip Guardrail / Moderation classifier output
    cleaned = re.sub(
        r'(?:Thus (?:both|all) are safe|We must output exactly that format|Safety Assessment:|Content Moderation:)[\s\S]*',
        '',
        cleaned,
        flags=re.IGNORECASE
    )
    cleaned = re.sub(
        r'(?:(?:User|Input|Prompt|Response|Output|Assistant)\s*(?:Safety|Moderation|Guard|Risk|Category|Harm)\s*[:=]\s*\w+[\s\n\r]*)+',
        '',
        cleaned,
        flags=re.IGNORECASE
    )

    # 4. Strip turn hallucination (model simulating subsequent User:/Human: turns at the end)
    cleaned = re.sub(r'\n+\s*(?:(?:User|Human|System)\s*:[^\n]+[\s\n\r]*)+$', '', cleaned, flags=re.IGNORECASE)

    # 5. Strip stray internal scratchpad / reflection tags
    cleaned = re.sub(r'<\/?(?:scratchpad|internal|reflection|antThinking)>', '', cleaned, flags=re.IGNORECASE)

    return cleaned.strip()


@router.post("")
async def chat_stream(
    chat_req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Core Chat Endpoint with SSE streaming, decoupled LLM adapter, and Mem0 long-term memory retrieval.
    """
    user_id = current_user.id

    # 1. Fetch User Settings & System Prompt Override
    settings_stmt = select(UserSetting).where(UserSetting.user_id == user_id)
    user_settings = (await db.execute(settings_stmt)).scalar_one_or_none()

    base_system_prompt = chat_req.system_prompt_override or (
        user_settings.system_prompt if user_settings else "你是一个智能、真诚、有洞察力的个人智能助理。"
    )
    model_to_use = chat_req.model or (user_settings.default_model if user_settings else app_settings.DEFAULT_MODEL)
    temperature = chat_req.temperature if chat_req.temperature is not None else (user_settings.temperature if user_settings else 0.7)
    use_memory = chat_req.memory_enabled if chat_req.memory_enabled is not None else (user_settings.memory_enabled if user_settings else True)
    memory_score_thresh = chat_req.memory_score_threshold if chat_req.memory_score_threshold is not None else 0.35
    selected_image_model = user_settings.image_model if user_settings else None
    selected_video_model = user_settings.video_model if user_settings else None

    # Validate model permission (new users only have access to free models until granted by admin)
    if not check_user_can_use_model(current_user, model_to_use):
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="TRIAL_CHAT_MODEL_FORBIDDEN",
        )

    # Billable side features (AI image and video generation) permissions
    is_full_access = has_full_model_access(current_user)
    image_gen_free_only = not is_full_access

    # 体验用户禁止使用视频生成功能
    if not is_full_access and getattr(chat_req, "video_gen_mode", False):
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="TRIAL_VIDEO_GEN_FORBIDDEN",
        )

    # 1.1 Resolve the caller's own provider credential for this model, if any.
    provider_name = (chat_req.provider or "").strip() or detect_provider(model_to_use)
    caller_api_key, caller_base_url = await resolve_user_llm_credentials(
        db, user_id, provider_name, model_to_use
    )

    # 2. Fetch or create conversation
    conversation = None
    if chat_req.conversation_id:
        stmt = select(Conversation).where(
            Conversation.id == chat_req.conversation_id,
            Conversation.user_id == user_id,
            Conversation.is_deleted == False
        )
        conversation = (await db.execute(stmt)).scalar_one_or_none()
        if not conversation:
            raise ApiError(
                status_code=status.HTTP_404_NOT_FOUND,
                code="CONVERSATION_NOT_FOUND_OR_DENIED",
            )
        if chat_req.model and chat_req.model != conversation.model:
            conversation.model = chat_req.model
        conversation.updated_at = datetime.now(timezone.utc)
        await db.commit()
        is_first_turn = False
    else:
        # Create new conversation with title generated from user input
        first_input = chat_req.message.strip() if chat_req.message else ""
        if not first_input and chat_req.attachments:
            first_input = f"分析: {chat_req.attachments[0].name}"
        conv_title = (first_input[:30] + "...") if len(first_input) > 30 else first_input
        conversation = Conversation(
            user_id=user_id,
            title=conv_title.strip() or "新建对话",
            model=model_to_use
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        is_first_turn = True

    conv_id = conversation.id

    # 3. Parse Attachments (Images & Documents/PDFs) with Untrusted XML Shielding
    parsed_images = []
    parsed_docs = []
    if chat_req.attachments:
        for att in chat_req.attachments:
            parsed = parse_attachment(att.name, att.mime_type or "", att.data_url)
            if parsed["type"] == "image":
                parsed_images.append(parsed)
            else:
                parsed_docs.append(parsed)

    # 3.1 Automatically detect and download remote files/URLs in message
    if chat_req.message:
        detected_urls = extract_urls(chat_req.message)
        for u in detected_urls[:3]:
            try:
                parsed_res = await fetch_and_parse_url(u)
                if parsed_res:
                    if parsed_res["type"] == "image":
                        parsed_images.append(parsed_res)
                    else:
                        parsed_docs.append(parsed_res)
            except Exception as e:
                logger.warning("Failed to auto-fetch remote file from URL %s: %s", u, e)

    # Assemble prompt text for LLM (including quoted reply & safe untrusted document text)
    user_text_parts = []
    if chat_req.quoted_content:
        user_text_parts.append(
            assemble_quoted_reply_prompt(chat_req.quoted_content, chat_req.quoted_message_id)
        )

    if chat_req.message and chat_req.message.strip():
        user_text_parts.append(chat_req.message.strip())

    if parsed_docs:
        for doc in parsed_docs:
            safe_doc_content = sanitize_untrusted_content(
                doc.get('extracted_text', ''),
                source_type="document",
                source_name=doc.get('name', 'file')
            )
            user_text_parts.append(f"\n\n{safe_doc_content}")

    full_user_text = "\n".join(user_text_parts) if user_text_parts else (chat_req.message or "")

    # 4. Retrieve relevant long-term memories if enabled (with score threshold)
    retrieved_memories = []
    memory_context_str = ""
    if use_memory:
        clean_mem_msg = re.sub(r"https?://[^\s<>\"'()]+", "", chat_req.message or "").strip()
        mem_query = clean_mem_msg if clean_mem_msg else (parsed_docs[0]['name'] if parsed_docs else "")
        if mem_query and should_retrieve_memories(mem_query):
            retrieved_memories, memory_context_str = await asyncio.to_thread(
                retrieve_relevant_memories,
                user_id=user_id,
                query=mem_query,
                limit=5,
            )
            # Filter low relevance memories by threshold if requested
            if retrieved_memories and memory_score_thresh > 0:
                filtered_mems = [m for m in retrieved_memories if m.get("score", 1.0) >= memory_score_thresh]
                if len(filtered_mems) < len(retrieved_memories):
                    retrieved_memories = filtered_mems
                    if not retrieved_memories:
                        memory_context_str = ""

    # 5. Fetch recent conversation messages using Token-Budget Sliding Window
    # When single_turn_mode is True (e.g., translation / vocab tutor), skip history context entirely
    if getattr(chat_req, "single_turn_mode", False):
        recent_msgs = []
    else:
        # Read up to 50 raw messages, then dynamically truncate to a token budget (e.g. 8192 tokens)
        msg_stmt = (
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc())
            .limit(50)
        )
        raw_recent_msgs = (await db.execute(msg_stmt)).scalars().all()
        recent_msgs = truncate_conversation_history_by_budget(raw_recent_msgs, max_tokens=8192)

    # 5.1 本地确定性事实核验（数字比大小、字符清点、算术与日期天数差）
    deterministic_context_str = evaluate_deterministic_context(full_user_text)

    # 6. Assemble messages payload for LLM Adapter (时基、确定性核验事实、防翻车规则、记忆、检索与排版规则)
    messages_payload = []
    combined_system_content = build_system_prompt(
        base_prompt=base_system_prompt,
        memory_context=memory_context_str,
        deterministic_context=deterministic_context_str
    )
    messages_payload.append({"role": "system", "content": combined_system_content})

    # Rehydrate up to the latest 3 historical user images and any uploaded document texts so models retain multi-turn context
    rehydrated_images_by_msg_key: Dict[Any, List[str]] = {}
    rehydrated_docs_by_msg_key: Dict[Any, List[Dict[str, str]]] = {}
    images_budget = 3

    for msg in reversed(recent_msgs):
        if msg.role != "user":
            continue

        msg_imgs: List[str] = []
        msg_docs: List[Dict[str, str]] = []
        if getattr(msg, "user_attachments", None):
            try:
                atts = json.loads(msg.user_attachments)
                if isinstance(atts, list):
                    for att in atts:
                        if isinstance(att, dict):
                            att_type = att.get("type", "image")
                            if att_type == "document" and att.get("text"):
                                msg_docs.append({
                                    "name": att.get("name") or "file",
                                    "text": att.get("text", "")
                                })
                            elif att_type != "document" and images_budget > 0:
                                d_url = _resolve_image_to_data_url(
                                    image_id=att.get("id"),
                                    rel_path=att.get("path"),
                                    ext=att.get("ext")
                                )
                                if d_url:
                                    msg_imgs.append(d_url)
                                    images_budget -= 1
            except Exception as parse_err:
                logger.warning("Failed to parse user_attachments for msg %s: %s", getattr(msg, "id", None), parse_err)

        if not msg_imgs and images_budget > 0 and msg.content and "/api/media/images/" in msg.content:
            found_ids = re.findall(r"/api/media/images/([0-9a-f]{32})", msg.content)
            for fid in found_ids:
                if images_budget <= 0:
                    break
                d_url = _resolve_image_to_data_url(image_id=fid)
                if d_url and d_url not in msg_imgs:
                    msg_imgs.append(d_url)
                    images_budget -= 1

        key = getattr(msg, "id", None) or id(msg)
        if msg_imgs:
            rehydrated_images_by_msg_key[key] = msg_imgs
        if msg_docs:
            rehydrated_docs_by_msg_key[key] = msg_docs

    for msg in recent_msgs:
        cleaned_content = msg.content or ""
        # Strip historical <think>...</think> blocks to avoid polluting context and blowing token budgets
        if "<think>" in cleaned_content:
            cleaned_content = re.sub(r"<think>[\s\S]*?</think>", "", cleaned_content).strip()

        # Clean markdown image tags from text representation to avoid confusing the model with unreachable URLs
        cleaned_content = re.sub(r"!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^)]+\)", r"[附图: \1]", cleaned_content)
        cleaned_content = re.sub(r"!\[([^\]]*)\]\(/api/media/images/[0-9a-f]{32}\)", r"[附图: \1]", cleaned_content).strip()

        key = getattr(msg, "id", None) or id(msg)
        hist_images = rehydrated_images_by_msg_key.get(key, [])
        hist_docs = rehydrated_docs_by_msg_key.get(key, [])

        # Rehydrate document contents safely into the message text if present in history
        if hist_docs and msg.role == "user":
            doc_append_texts = []
            for doc in hist_docs:
                # Avoid re-injecting if already present in content for any reason
                if doc["name"] not in cleaned_content or "untrusted_document" not in cleaned_content:
                    safe_doc = sanitize_untrusted_content(
                        doc["text"],
                        source_type="document",
                        source_name=doc["name"]
                    )
                    doc_append_texts.append(f"\n\n{safe_doc}")
            if doc_append_texts:
                cleaned_content = (cleaned_content + "".join(doc_append_texts)).strip()

        if hist_images and msg.role == "user":
            user_parts: List[Dict[str, Any]] = [
                {"type": "text", "text": cleaned_content or "[用户历史附图]"}
            ]
            for img_data_url in hist_images:
                user_parts.append({
                    "type": "image_url",
                    "image_url": {"url": img_data_url}
                })
            messages_payload.append({"role": msg.role, "content": user_parts})
        else:
            if cleaned_content:
                messages_payload.append({"role": msg.role, "content": cleaned_content})

    if parsed_images:
        user_content: List[Dict[str, Any]] = [
            {"type": "text", "text": full_user_text or "请分析此图片。"}
        ]
        for img in parsed_images:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": img["data_url"]}
            })
        messages_payload.append({"role": "user", "content": user_content})
    else:
        messages_payload.append({"role": "user", "content": full_user_text})

    # Apply prompt caching optimizations (Anthropic cache_control, DeepSeek prefixes)
    messages_payload = apply_prompt_cache_markers(messages_payload, provider=provider_name)

    # 7. Save current user message to DB
    user_created_at = datetime.now(timezone.utc)
    user_tokens = estimate_token_count(full_user_text) + len(parsed_images) * 800

    saved_content_parts = []
    if chat_req.message and chat_req.message.strip():
        saved_content_parts.append(chat_req.message.strip())
    for doc in parsed_docs:
        saved_content_parts.append(f"📄 **[附件文件: {doc['name']}]**")

    # Uploaded images are written to MEDIA_DIR and recorded by id; `content` keeps
    # only an /api/media/images/{id} reference.
    stored_attachments = []
    for doc in parsed_docs:
        extracted = doc.get("extracted_text", "")
        if extracted:
            # Store up to 20,000 characters per document in attachment record for multi-turn rehydration
            stored_attachments.append({
                "type": "document",
                "name": doc.get("name") or "file",
                "mime_type": doc.get("mime_type") or "text/plain",
                "text": extracted[:20000]
            })

    for img in parsed_images:
        stored = store_uploaded_image(img["data_url"], img.get("name") or "图片")
        if stored:
            stored_attachments.append(stored)
            saved_content_parts.append(
                f"![{stored['name']}]({MEDIA_IMAGE_PATH_PREFIX}{stored['id']})"
            )
        else:
            saved_content_parts.append(f"![{img['name']}]({img['data_url']})")
    saved_user_content = "\n\n".join(saved_content_parts) if saved_content_parts else (chat_req.message or "附件")

    user_msg_record = Message(
        conversation_id=conv_id,
        role="user",
        content=saved_user_content,
        model=model_to_use,
        prompt_tokens=user_tokens,
        user_attachments=json.dumps(stored_attachments, ensure_ascii=False) if stored_attachments else None,
        created_at=user_created_at
    )
    db.add(user_msg_record)

    conv_rec = await db.get(Conversation, conv_id)
    if conv_rec:
        conv_rec.last_message_at = user_created_at

    await db.commit()


    # 7. SSE Streaming generator with FULL error capture
    async def sse_event_stream() -> AsyncGenerator[str, None]:
        full_assistant_reply = []
        start_time = time.time()
        first_token_time = None
        provider = None

        search_results = []
        search_answer: Optional[str] = None
        generated_images = []
        generated_videos = []
        tool_invocations = []
        search_mode = (
            chat_req.web_search_mode
            or (user_settings.web_search_mode if user_settings else None)
            or "auto"
        )
        need_search = False
        search_query = ""
        search_queries: List[str] = []
        search_topic = "general"
        search_time_range = None
        need_image_gen, img_prompt, img_size = should_generate_image(chat_req.message)
        need_video_gen, video_prompt, video_ratio = should_generate_video(chat_req.message)

        # Explicit button toggle overrides / forces image or video generation
        if getattr(chat_req, "image_gen_mode", False):
            need_image_gen = True
            need_video_gen = False
            if not img_prompt:
                img_prompt = (chat_req.message or "").strip()
            if not img_size:
                img_size = "1024x1024"
        elif getattr(chat_req, "video_gen_mode", False):
            need_video_gen = True
            need_image_gen = False
            if not video_prompt:
                video_prompt = (chat_req.message or "").strip()
            # If user message specifies aspect ratio, keep it, else default 16:9
            if not video_ratio:
                video_ratio = "16:9"

        # If both match, let video take precedence if it explicitly mentioned video/短视频
        if need_video_gen and need_image_gen:
            need_image_gen = False
        finish_reason = "stop"  # 'stop' | 'abort' | 'error'
        error_text: Optional[str] = None
        yield_allowed = True

        try:
            # 0. Intelligent web search decision & context-aware query generation (ChatGPT style)
            if search_mode != "off":
                need_search, search_query, search_queries, search_topic, search_time_range = await evaluate_and_generate_search_query(
                    user_message=chat_req.message or "",
                    recent_messages=recent_msgs,
                    mode=search_mode,
                    model=model_to_use,
                    provider=provider_name,
                    api_key=caller_api_key,
                    base_url=caller_base_url,
                )

            # 1. Check and execute AI Image Generation if requested
            if need_image_gen and img_prompt:
                tool_call_id = f"img_{int(time.time() * 1000)}"
                logger.info("Executing image generation for prompt: '%s' (size=%s)", img_prompt, img_size)
                yield f"data: {json.dumps({'type': 'tool_call', 'toolCallId': tool_call_id, 'toolName': 'image_generation', 'args': {'prompt': img_prompt, 'size': img_size}}, ensure_ascii=False)}\n\n"
                tool_invocations.append({
                    "toolCallId": tool_call_id,
                    "toolName": "image_generation",
                    "args": {"prompt": img_prompt, "size": img_size},
                    "state": "call",
                })

                try:
                    img_res = await image_gen_service.generate(
                        img_prompt,
                        size=img_size,
                        model=selected_image_model,
                        free_only=image_gen_free_only,
                    )
                    img_url = img_res["url"]
                    img_provider = img_res.get("provider", "AI生图")
                    img_model = img_res.get("model", "unknown")

                    stored_meta = None
                    try:
                        stored_meta = await store_generated_image(
                            url=img_url,
                            prompt=img_prompt,
                            provider=img_provider,
                            model=img_model,
                        )
                    except Exception as se:
                        logger.warning("Failed to persist generated image: %s", se)

                    image_id = stored_meta.get("id") if stored_meta else None
                    if image_id:
                        generated_images.append(stored_meta)
                    yield f"data: {json.dumps({'type': 'image_result', 'toolCallId': tool_call_id, 'imageId': image_id, 'url': img_url, 'prompt': img_prompt, 'provider': img_provider, 'model': img_model}, ensure_ascii=False)}\n\n"
                    yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': {'prompt': img_prompt, 'model': img_model, 'provider': img_provider}}, ensure_ascii=False)}\n\n"
                    if tool_invocations:
                        tool_invocations[-1]["state"] = "result"
                        tool_invocations[-1]["result"] = {"prompt": img_prompt, "model": img_model, "provider": img_provider}

                    # Provide system context about generated image so LLM can explain or converse about it
                    img_context_hint = f"\n\n【🎨 AI生图系统通知】已成功生成画作（提示词: {img_prompt}，引擎: {img_provider} · {img_model}）。图片已由前端卡片渲染。请针对用户的原始输入进行自然、得体的说明或继续完成用户要求的故事/文案等要求。"
                    if messages_payload and messages_payload[0].get("role") == "system":
                        messages_payload[0]["content"] += img_context_hint
                    else:
                        messages_payload.insert(0, {"role": "system", "content": img_context_hint})

                except Exception as ie:
                    logger.warning("Image generation service failed: %s", str(ie))
                    yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': {'error': str(ie)}}, ensure_ascii=False)}\n\n"
                    if tool_invocations:
                        tool_invocations[-1]["state"] = "result"
                        tool_invocations[-1]["result"] = {"error": str(ie)}
                    err_hint = f"\n\n【🎨 AI生图失败提示】生图失败: {str(ie)}。请在回答中向用户说明原因并给出建议。"
                    if messages_payload and messages_payload[0].get("role") == "system":
                        messages_payload[0]["content"] += err_hint

            # 1.5 Check and execute AI Video Generation if requested
            if need_video_gen and video_prompt:
                if not is_full_access:
                    tool_call_id = f"vid_{int(time.time() * 1000)}"
                    yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': {'error': '体验模式账号暂不支持使用视频生成功能'}}, ensure_ascii=False)}\n\n"
                    vid_err_hint = "\n\n【🎬 AI视频生成提示】当前账号处于体验模式，暂不支持使用 AI 视频生成功能。请向用户委婉说明该权限需联系管理员开通。"
                    if messages_payload and messages_payload[0].get("role") == "system":
                        messages_payload[0]["content"] += vid_err_hint
                    else:
                        messages_payload.insert(0, {"role": "system", "content": vid_err_hint})
                else:
                    tool_call_id = f"vid_{int(time.time() * 1000)}"
                    logger.info("Executing video generation for prompt: '%s' (aspect_ratio=%s)", video_prompt, video_ratio)
                    yield f"data: {json.dumps({'type': 'tool_call', 'toolCallId': tool_call_id, 'toolName': 'video_generation', 'args': {'prompt': video_prompt, 'aspect_ratio': video_ratio}}, ensure_ascii=False)}\n\n"
                    tool_invocations.append({
                        "toolCallId": tool_call_id,
                        "toolName": "video_generation",
                        "args": {"prompt": video_prompt, "aspect_ratio": video_ratio},
                        "state": "call",
                    })

                    try:
                        vid_res = await video_gen_service.generate_video(
                            video_prompt,
                            model=selected_video_model,
                            aspect_ratio=video_ratio,
                            free_only=False,
                        )
                        vid_bytes = vid_res["bytes"]
                        vid_provider = vid_res.get("provider", "openrouter")
                        vid_model = vid_res.get("model", "unknown")

                        stored_vid_meta = None
                        try:
                            stored_vid_meta = await store_generated_video(
                                data_or_url=vid_bytes,
                                prompt=video_prompt,
                                provider=vid_provider,
                                model=vid_model,
                                ext=vid_res.get("ext", "mp4"),
                            )
                        except Exception as ve:
                            logger.warning("Failed to persist generated video: %s", ve)

                        video_id = stored_vid_meta.get("id") if stored_vid_meta else None
                        if video_id:
                            generated_videos.append(stored_vid_meta)

                        yield f"data: {json.dumps({'type': 'video_result', 'toolCallId': tool_call_id, 'videoId': video_id, 'prompt': video_prompt, 'provider': vid_provider, 'model': vid_model}, ensure_ascii=False)}\n\n"
                        yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': {'prompt': video_prompt, 'model': vid_model, 'provider': vid_provider, 'videoId': video_id}}, ensure_ascii=False)}\n\n"
                        if tool_invocations:
                            tool_invocations[-1]["state"] = "result"
                            tool_invocations[-1]["result"] = {"prompt": video_prompt, "model": vid_model, "provider": vid_provider, "videoId": video_id}

                        vid_context_hint = f"\n\n【🎬 AI视频生成系统通知】已成功生成视频（提示词: {video_prompt}，模型: {vid_provider} · {vid_model}）。视频已由前端播放器卡片渲染。请针对用户的原始请求进行得体友好的说明或继续提供相关建议。"
                        if messages_payload and messages_payload[0].get("role") == "system":
                            messages_payload[0]["content"] += vid_context_hint
                        else:
                            messages_payload.insert(0, {"role": "system", "content": vid_context_hint})

                    except Exception as ve:
                        logger.warning("Video generation service failed: %s", str(ve))
                        yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': {'error': str(ve)}}, ensure_ascii=False)}\n\n"
                        if tool_invocations:
                            tool_invocations[-1]["state"] = "result"
                            tool_invocations[-1]["result"] = {"error": str(ve)}
                        vid_err_hint = f"\n\n【🎬 AI视频生成失败提示】视频生成失败: {str(ve)}。请在回答中向用户说明原因并给出建议。"
                        if messages_payload and messages_payload[0].get("role") == "system":
                            messages_payload[0]["content"] += vid_err_hint

            # 2. Check and execute automatic search before streaming LLM tokens
            if need_search and (search_query or search_queries):
                tool_call_id = f"call_{int(time.time() * 1000)}"
                effective_queries = [q for q in (search_queries or [search_query]) if q and q.strip()]
                if not effective_queries:
                    effective_queries = [search_query] if search_query else []
                # 合并展示词（如多个词用 、 连接展示），兼顾前端与可读性
                display_query = " 、 ".join(effective_queries) if len(effective_queries) > 1 else (effective_queries[0] if effective_queries else search_query)
                search_query = display_query  # 同步更新主 query，供下文引用及入库

                logger.info(
                    "Executing web search for queries: %s (mode=%s, topic=%s, time_range=%s)",
                    effective_queries, search_mode, search_topic, search_time_range
                )
                yield f"data: {json.dumps({'type': 'search_start', 'query': display_query}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'tool_call', 'toolCallId': tool_call_id, 'toolName': 'web_search', 'args': {'query': display_query, 'queries': effective_queries}}, ensure_ascii=False)}\n\n"
                tool_invocations.append({
                    "toolCallId": tool_call_id,
                    "toolName": "web_search",
                    "args": {"query": display_query, "queries": effective_queries},
                    "state": "call",
                })
                try:
                    # 并发拉取各个维度的检索词（每个检索词拉取最多 10 条）
                    search_tasks = [
                        web_search_service.search(
                            q, max_results=10, topic=search_topic, time_range=search_time_range
                        )
                        for q in effective_queries[:3]
                    ]
                    outcomes = await asyncio.gather(*search_tasks, return_exceptions=True)

                    # 结果按 URL 规范化去重聚合，最多取 20 条最相关网页
                    seen_urls = set()
                    aggregated_results = []
                    search_answer = None

                    for outcome in outcomes:
                        if isinstance(outcome, Exception) or not outcome:
                            continue
                        if not search_answer and getattr(outcome, "answer", None):
                            search_answer = outcome.answer
                        for item in getattr(outcome, "results", []) or []:
                            raw_u = (item.get("url") or "").strip()
                            norm_u = raw_u.rstrip("/").lower()
                            if norm_u and norm_u not in seen_urls:
                                seen_urls.add(norm_u)
                                item_copy = dict(item)
                                snippet = item_copy.get("snippet", "")
                                if len(snippet) > 400:
                                    item_copy["snippet"] = snippet[:400].rstrip() + "..."
                                aggregated_results.append(item_copy)
                            if len(aggregated_results) >= 20:
                                break

                    search_results = aggregated_results
                except Exception as se:
                    logger.warning("Web search service failed for '%s': %s", display_query, str(se))
                    search_results = []
                    search_answer = None

                if tool_invocations:
                    tool_invocations[-1]["state"] = "result"
                    tool_invocations[-1]["result"] = search_results

                yield f"data: {json.dumps({'type': 'search_results', 'query': display_query, 'results': search_results, 'answer': search_answer}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': search_results}, ensure_ascii=False)}\n\n"

                if search_results or search_answer:
                    search_lines = [
                        f"\n\n【🌐 实时网络检索最新参考资料 (搜索词: {display_query})】"
                    ]
                    if search_answer:
                        search_lines.append(
                            "【检索系统综合摘要（由检索服务自动生成，可能存在偏差，仅供参考，请以下方逐条资料为准交叉验证）】\n"
                            f"{search_answer}"
                        )
                    if search_results:
                        search_lines.append(
                            "【联网资料引用与回答规范（必须严格执行）】\n"
                            "1. 系统已自动联网检索到以下最新网页内容，请以客观、详实、严谨的态度参考这些资料回答用户提问。\n"
                            "2. 【引用紧跟在每句话后面，严禁在全文末尾放注释】：\n"
                            "   - 严禁在全文最底部集中放“### 参考来源”或尾注列表！\n"
                            "   - 每当你的回答中提到来自某个网页的具体事实、数据、政策或结论时，必须直接紧跟在【该句话的句尾】以 Markdown 链接标注引用来源。\n"
                            "   - 引用格式为：[来源: 网站或机构名](对应网页完整URL)\n"
                            "   - 示例写法：\n"
                            "     “日本经产省官方调查预测，到 2030 年 IT 人才缺口最高可达 79 万人 [来源: 经济产业省](https://www.meti.go.jp/...)。而在实际招聘端，云架构师与 AI 工程师的求人倍率持续高居第一 [来源: doda](https://doda.jp/...)。”\n"
                            "   - 链接中的网站/机构名请保持简短精炼，网址必须严格直接使用下方资料中提供的真实网址，严禁虚构任何链接。\n\n"
                            "【已检索到的实时参考资料列表】:"
                        )
                        for idx, r in enumerate(search_results, 1):
                            search_lines.append(f"[{idx}] 《{r['title']}》\n    网址: {r['url']}\n    内容摘要: {r['snippet']}")
                    else:
                        search_lines.append(
                            "检索服务未返回可引用的网页条目。若回答依赖具体事实，请坦诚告知用户缺少可核实的来源，"
                            "严禁虚构引用编号或链接。"
                        )
                    search_context_str = "\n".join(search_lines)

                    if messages_payload and messages_payload[0].get("role") == "system":
                        messages_payload[0]["content"] += search_context_str
                    else:
                        messages_payload.insert(0, {"role": "system", "content": search_context_str})

            # 3. First send metadata chunk containing conversation_id and retrieved memories
            meta_chunk = {
                "type": "meta",
                "conversation_id": conv_id,
                "user_message_id": user_msg_record.id,
                "model": model_to_use,
                "retrieved_memories": retrieved_memories,
                "search_results": search_results if search_results else None,
                "search_query": search_query if need_search else None,
                "search_answer": search_answer,
                "created_at": user_created_at.isoformat()
            }
            yield f"data: {json.dumps(meta_chunk, ensure_ascii=False, default=str)}\n\n"

            # 4. Obtain LLM Provider
            provider = get_llm_provider(
                provider=chat_req.provider,
                model=model_to_use,
                api_key=caller_api_key,
                base_url=caller_base_url,
            )

            # 5. Stream LLM generation tokens with keep-alive heartbeat and real-time leak filter
            stream_window = ""
            suppressed = False
            in_thinking = False

            extra_llm_kwargs = {}
            if chat_req.max_tokens:
                extra_llm_kwargs["max_tokens"] = chat_req.max_tokens
            if chat_req.reasoning_effort:
                extra_llm_kwargs["reasoning_effort"] = chat_req.reasoning_effort

            token_iter = provider.chat(
                messages=messages_payload,
                model=model_to_use,
                stream=True,
                temperature=temperature,
                **extra_llm_kwargs
            )

            while True:
                try:
                    # Keep-alive heartbeat: wait at most 15s for next token.
                    # If model is deep reasoning, emit standard SSE comment to prevent gateway 504 timeouts.
                    token = await asyncio.wait_for(token_iter.__anext__(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                except StopAsyncIteration:
                    break

                if first_token_time is None:
                    first_token_time = time.time()
                full_assistant_reply.append(token)

                if "<think>" in token:
                    in_thinking = True
                if "</think>" in token:
                    in_thinking = False

                if suppressed:
                    # Recover when closing tag is encountered
                    if any(close_tag in token for close_tag in LEAK_CLOSING):
                        suppressed = False
                        stream_window = ""
                    continue

                stream_window += token

                # Inside <think>...</think>, reasoning models must be allowed to think freely
                if in_thinking:
                    delta_payload = {
                        "type": "content",
                        "conversation_id": conv_id,
                        "delta": stream_window
                    }
                    yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"
                    stream_window = ""
                    continue

                # 1. Check if any trigger is fully inside the window
                matched_trigger = False
                for trig in LEAK_TRIGGERS:
                    if trig in stream_window:
                        trig_pos = stream_window.find(trig)
                        safe_part = stream_window[:trig_pos]
                        if safe_part:
                            delta_payload = {
                                "type": "content",
                                "conversation_id": conv_id,
                                "delta": safe_part
                            }
                            yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"
                        stream_window = ""
                        suppressed = True
                        matched_trigger = True
                        break
                if matched_trigger:
                    continue

                # 2. Check if stream_window ends with a prefix of any trigger
                hold_back = 0
                for trig in LEAK_TRIGGERS:
                    for i in range(len(trig) - 1, 0, -1):
                        if stream_window.endswith(trig[:i]):
                            hold_back = max(hold_back, i)
                            break

                if hold_back > 0:
                    safe_len = len(stream_window) - hold_back
                    if safe_len > 0:
                        to_send = stream_window[:safe_len]
                        stream_window = stream_window[safe_len:]
                        delta_payload = {
                            "type": "content",
                            "conversation_id": conv_id,
                            "delta": to_send
                        }
                        yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"
                else:
                    delta_payload = {
                        "type": "content",
                        "conversation_id": conv_id,
                        "delta": stream_window
                    }
                    yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"
                    stream_window = ""

            # Flush remaining window if not suppressed
            if stream_window and not suppressed:
                delta_payload = {
                    "type": "content",
                    "conversation_id": conv_id,
                    "delta": stream_window
                }
                yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"

            # Ensure <think> tag is cleanly closed if model aborted mid-thought
            if in_thinking:
                close_think = "\n</think>\n\n"
                full_assistant_reply.append(close_think)
                yield f"data: {json.dumps({'type': 'content', 'conversation_id': conv_id, 'delta': close_think}, ensure_ascii=False)}\n\n"
                in_thinking = False

            # Check if assistant reply yielded any visible main body outside of <think>...</think>
            current_raw_reply = "".join(full_assistant_reply)
            has_body_text = bool(re.sub(r"<think>[\s\S]*?</think>", "", current_raw_reply).strip())
            if not has_body_text and finish_reason in ("stop", "length", None) and not error_text:
                logger.warning("Model finished without body text for conversation %s, triggering auto-completion fallback", conv_id)
                try:
                    recovery_messages = [
                        {"role": "system", "content": "你是一个智能助理。请直接根据用户的最新提问给出清晰、全面、详细的中文解答。严禁输出任何思考标签或内部标签，直接给出正文："},
                        {"role": "user", "content": full_user_text or chat_req.message or ""}
                    ]
                    recovered = await provider.complete(
                        messages=recovery_messages,
                        model=model_to_use,
                        temperature=0.3,
                        max_tokens=1500
                    )
                    if recovered and recovered.strip():
                        recovered_text = sanitize_llm_output(recovered).strip()
                        recovered_text = re.sub(r"<think>[\s\S]*?</think>", "", recovered_text).strip()
                        if recovered_text:
                            yield f"data: {json.dumps({'type': 'content', 'conversation_id': conv_id, 'delta': recovered_text}, ensure_ascii=False)}\n\n"
                            full_assistant_reply.append(recovered_text)
                except Exception as rec_err:
                    logger.warning("Auto-completion fallback failed for conversation %s: %s", conv_id, rec_err)

            # Capture upstream finish_reason from provider (e.g. length, content_filter, stop)
            if provider and getattr(provider, "last_finish_reason", None) and finish_reason == "stop":
                finish_reason = provider.last_finish_reason


        except asyncio.CancelledError:
            finish_reason = "abort"
            logger.info("Stream cancelled by client for conversation %s; persisting partial reply", conv_id)

        except GeneratorExit:
            finish_reason = "abort"
            yield_allowed = False
            logger.info("Stream iterator closing for conversation %s; persisting partial reply", conv_id)

        except Exception as e:
            finish_reason = "error"
            # EXTRACT ALL BACKEND ERROR DETAILS
            error_type = type(e).__name__
            error_message = str(e)
            details = [f"**❌ 模型调用失败 [{error_type}]**\n\n{error_message}"]

            # Extract HTTP status and raw response body if available (e.g., from OpenAI/OpenRouter APIError)
            if hasattr(e, "status_code"):
                details.append(f"**HTTP 状态码**: `{getattr(e, 'status_code')}`")
            if hasattr(e, "response") and hasattr(e.response, "text"):
                details.append(f"**供应商返回原始信息**:\n```json\n{e.response.text}\n```")
            elif hasattr(e, "body") and getattr(e, "body"):
                body_content = getattr(e, "body")
                details.append(f"**供应商响应内容**:\n```json\n{json.dumps(body_content, ensure_ascii=False, indent=2)}\n```")
            elif hasattr(e, "message") and getattr(e, "message") != error_message:
                details.append(f"**详细描述**: {getattr(e, 'message')}")

            error_text = "\n\n".join(details)
            logger.error("Error during LLM streaming for user %s: %s", user_id, error_text, exc_info=True)

            error_payload = {
                "type": "error",
                "conversation_id": conv_id,
                "error": error_text,
                "finish_reason": finish_reason,
            }
            yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"

        # 9. Calculate latency, reply time and accurate token stats
        duration_ms = max(20, int((time.time() - start_time) * 1000))
        thinking_duration_ms = max(0, int((first_token_time - start_time) * 1000)) if first_token_time else duration_ms
        reply_created_at = datetime.now(timezone.utc)
        assistant_content = sanitize_llm_output("".join(full_assistant_reply))

        usage = getattr(provider, "last_usage", None) or {}
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")

        # Fallback estimation when provider did not report usage
        try:
            if not prompt_tokens:
                prompt_text = " ".join(
                    str(m.get("content") or "") for m in messages_payload
                )
                prompt_tokens = estimate_token_count(prompt_text)
            if not completion_tokens:
                completion_tokens = estimate_token_count(assistant_content)
        except Exception as est_err:
            logger.warning(
                "Token estimation failed for conversation %s: %s", conv_id, est_err
            )

        prompt_tokens = int(prompt_tokens or 0)
        completion_tokens = int(completion_tokens or 0)
        total_tokens = prompt_tokens + completion_tokens

        # Persist error or refusal if content is empty
        if not assistant_content.strip():
            if error_text:
                assistant_content = error_text
            elif finish_reason == "content_filter":
                assistant_content = "⚠️ 该提问触发了上游模型内容安全审核拦截（Content Filter），未返回有效回复内容。"
            elif finish_reason == "length":
                assistant_content = "⚠️ 模型在开始生成时即已达到单次最大 Token 限制，未能完成输出。"

        # Resolve actual model display name (e.g. "openrouter/free (llama-3.3-70b)")
        actual_model_id = getattr(provider, "last_model", None)
        recorded_model_name = model_to_use
        if actual_model_id and actual_model_id.lower() != model_to_use.lower():
            clean_sub_model = actual_model_id.split("/")[-1].replace(":free", "")
            recorded_model_name = f"{model_to_use} ({clean_sub_model})"

        # Persist assistant reply before emitting done payload
        assistant_message_id = None
        if assistant_content.strip():
            try:
                async with AsyncSessionLocal() as save_db:
                    # Update conversation updated_at so latest chat is at the top
                    c_stmt = select(Conversation).where(Conversation.id == conv_id)
                    c_rec = (await save_db.execute(c_stmt)).scalar_one_or_none()
                    if c_rec:
                        c_rec.updated_at = reply_created_at
                        c_rec.last_message_at = reply_created_at

                    assistant_msg_record = Message(
                        conversation_id=conv_id,
                        role="assistant",
                        content=assistant_content,
                        model=recorded_model_name,
                        token_usage=total_tokens,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        duration_ms=duration_ms,
                        thinking_duration_ms=thinking_duration_ms,
                        finish_reason=finish_reason,
                        search_results=json.dumps(search_results, ensure_ascii=False) if search_results else None,
                        search_query=search_query if need_search else None,
                        tool_invocations=json.dumps(tool_invocations, ensure_ascii=False) if tool_invocations else None,
                        generated_images=json.dumps(generated_images, ensure_ascii=False) if generated_images else None,
                        generated_videos=json.dumps(generated_videos, ensure_ascii=False) if generated_videos else None,
                        created_at=reply_created_at
                    )
                    save_db.add(assistant_msg_record)
                    await save_db.commit()
                    assistant_message_id = assistant_msg_record.id
            except Exception as persist_err:
                logger.error(
                    "Failed to persist assistant reply for conversation %s: %s",
                    conv_id, persist_err, exc_info=True,
                )

        # Signal completion with complete metadata
        done_payload = {
            "type": "done",
            "conversation_id": conv_id,
            "message_id": assistant_message_id,
            "model": recorded_model_name,
            "duration_ms": duration_ms,
            "thinking_duration_ms": thinking_duration_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "created_at": reply_created_at.isoformat(),
            "finish_reason": finish_reason,
            "search_results": search_results if search_results else None,
            "search_query": search_query if need_search else None,
            "search_answer": search_answer,
            "tool_invocations": tool_invocations if tool_invocations else None,
            "generated_images": generated_images if generated_images else None,
            "generated_videos": generated_videos if generated_videos else None,
        }
        if yield_allowed:
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        # 10. Background housekeeping: conversation title + memory extraction
        if assistant_content.strip():
            # Generate conversation title on first turn
            if is_first_turn:
                try:
                    new_title = await _generate_conversation_title(
                        chat_req.message or "(附件)",
                        assistant_content,
                        model_to_use,
                        provider_name,
                        api_key=caller_api_key,
                        base_url=caller_base_url,
                    )
                    if new_title:
                        async with AsyncSessionLocal() as title_db:
                            t_stmt = select(Conversation).where(Conversation.id == conv_id)
                            t_rec = (await title_db.execute(t_stmt)).scalar_one_or_none()
                            if t_rec:
                                t_rec.title = new_title[:40]
                                await title_db.commit()
                except Exception as title_err:
                    logger.warning("Failed to generate conversation title: %s", title_err)

            # Schedule memory extraction in background if enabled and not aborted
            if use_memory and finish_reason != "abort":
                clean_assistant = assistant_content
                if "<think>" in clean_assistant:
                    clean_assistant = re.sub(r"<think>[\s\S]*?</think>", "", clean_assistant).strip()
                    if not clean_assistant:
                        clean_assistant = assistant_content[:2000]

                user_content_for_memory = chat_req.message.strip() if chat_req.message else (
                    f"用户上传文件: {parsed_docs[0]['name']}" if parsed_docs else "用户上传了图片进行分析"
                )
                conversation_pair = [
                    {"role": "user", "content": user_content_for_memory},
                    {"role": "assistant", "content": clean_assistant}
                ]
                memory_model_to_use = getattr(user_settings, "memory_model", None) or "openai/gpt-4o-mini"
                await schedule_memory_extraction(
                    user_id=user_id,
                    messages=conversation_pair,
                    metadata={
                        "conversation_id": conv_id,
                        "source_messages": conversation_pair,
                    },
                    memory_model=memory_model_to_use
                )

                # Trigger dreaming summarization if message interval reached
                try:
                    from sqlalchemy import func
                    async with AsyncSessionLocal() as count_db:
                        count_stmt = select(func.count()).where(
                            Message.conversation_id == conv_id
                        )
                        total_msg_count: int = (await count_db.execute(count_stmt)).scalar() or 0

                    # Build plain-dict snapshots of recent messages for the executor
                    dreaming_messages = [
                        {"role": m.role, "content": m.content}
                        for m in recent_msgs  # recent_msgs already fetched above
                    ] + [
                        {"role": "user",      "content": user_content_for_memory},
                        {"role": "assistant", "content": clean_assistant},
                    ]

                    await schedule_dreaming(
                        user_id=user_id,
                        conv_id=conv_id,
                        total_message_count=total_msg_count,
                        recent_messages=dreaming_messages,
                        memory_model=memory_model_to_use,
                    )
                except Exception as dream_err:
                    logger.warning("Failed to schedule dreaming for user %s: %s", user_id, dream_err)


    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
