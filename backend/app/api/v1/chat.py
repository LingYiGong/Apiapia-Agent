import asyncio
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
from app.services.search import web_search_service, should_search_web
from app.services.image_gen import should_generate_image, image_gen_service
from app.services.media_storage import (
    MEDIA_IMAGE_PATH_PREFIX,
    store_generated_image,
    store_uploaded_image,
)
from app.services.prompt import build_system_prompt
from app.services.deterministic import evaluate_deterministic_context

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


def estimate_token_count(text: str) -> int:
    """Accurately estimate token count for multi-lingual text (Chinese + English)."""
    if not text:
        return 0
    zh_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - zh_chars
    return zh_chars + other_chars // 4


LEAK_TRIGGERS = [
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
    cleaned = re.sub(r'<\/?(?:arg_key|arg_value|parameter|parameters|arguments)[\s\S]*?>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\[(?:ACTION|SEARCH|TOOL|CALL|OBSERVATION):\s*[^\]]+\]', '', cleaned, flags=re.IGNORECASE)

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

    # 1. Fetch User Settings
    settings_stmt = select(UserSetting).where(UserSetting.user_id == user_id)
    user_settings = (await db.execute(settings_stmt)).scalar_one_or_none()

    system_prompt = user_settings.system_prompt if user_settings else "你是一个智能、真诚、有洞察力的个人智能助理。"
    model_to_use = chat_req.model or (user_settings.default_model if user_settings else "gpt-4o-mini")
    temperature = chat_req.temperature if chat_req.temperature is not None else (user_settings.temperature if user_settings else 0.7)
    use_memory = chat_req.memory_enabled if chat_req.memory_enabled is not None else (user_settings.memory_enabled if user_settings else True)
    selected_image_model = user_settings.image_model if user_settings else None

    # Validate model permission (new users only have access to free models until granted by admin)
    if not check_user_can_use_model(current_user, model_to_use):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前账号处于体验模式，仅支持访问免费模型。如需使用该模型，请联系管理员开通完整体验权限。"
        )

    # Billable side features (currently AI image generation) are restricted to the
    # same entitlement. Restricted accounts may only use the zero-cost image models.
    image_gen_free_only = not has_full_model_access(current_user)

    # 1.1 Resolve the caller's own provider credential for this model, if any.
    # A None here is the normal case and means "use the server's .env config".
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied"
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

    # 3. Parse Attachments (Images & Documents/PDFs)
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

    # Assemble prompt text for LLM (including extracted document text)
    user_text_parts = []
    if chat_req.message and chat_req.message.strip():
        user_text_parts.append(chat_req.message.strip())

    if parsed_docs:
        for doc in parsed_docs:
            user_text_parts.append(
                f"\n\n--- 📎 用户附带/引用文件: {doc['name']} ---\n{doc['extracted_text']}\n--- 结束文件: {doc['name']} ---"
            )

    full_user_text = "\n".join(user_text_parts) if user_text_parts else (chat_req.message or "")

    # 4. Retrieve relevant long-term memories if enabled
    retrieved_memories = []
    memory_context_str = ""
    if use_memory:
        clean_mem_msg = re.sub(r"https?://[^\s<>\"'()]+", "", chat_req.message or "").strip()
        mem_query = clean_mem_msg if clean_mem_msg else (parsed_docs[0]['name'] if parsed_docs else "")
        if mem_query and should_retrieve_memories(mem_query):
            # Must go to a thread. retrieve_relevant_memories is synchronous: it
            # talks to pgvector over psycopg2 and, on the profile pass, pulls the
            # user's memories and sorts them in Python. Calling it inline would park
            # the event loop for the whole round trip, so every other in-flight
            # request on this worker stalls behind one user's memory query.
            retrieved_memories, memory_context_str = await asyncio.to_thread(
                retrieve_relevant_memories,
                user_id=user_id,
                query=mem_query,
                limit=5,
            )

    # 5. Fetch recent conversation messages
    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    recent_msgs = (await db.execute(msg_stmt)).scalars().all()
    recent_msgs.reverse()  # chronological order

    # 5.1 本地确定性事实核验（数字比大小、字符清点、算术与日期天数差）
    deterministic_context_str = evaluate_deterministic_context(full_user_text)

    # 6. Assemble messages payload for LLM Adapter (时基、确定性核验事实、防翻车规则、记忆、检索与排版规则)
    messages_payload = []
    combined_system_content = build_system_prompt(
        base_prompt=system_prompt,
        memory_context=memory_context_str,
        deterministic_context=deterministic_context_str
    )
    messages_payload.append({"role": "system", "content": combined_system_content})

    for msg in recent_msgs:
        cleaned_content = msg.content
        if "data:image/" in cleaned_content:
            cleaned_content = re.sub(r"!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^)]+\)", r"[附图: \1]", cleaned_content)
        # Strip historical <think>...</think> blocks to avoid polluting context and blowing token budgets
        if "<think>" in cleaned_content:
            cleaned_content = re.sub(r"<think>[\s\S]*?</think>", "", cleaned_content).strip()
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

    # 7. Save current user message to DB
    user_created_at = datetime.now(timezone.utc)
    user_tokens = estimate_token_count(full_user_text) + len(parsed_images) * 800

    saved_content_parts = []
    if chat_req.message and chat_req.message.strip():
        saved_content_parts.append(chat_req.message.strip())
    for doc in parsed_docs:
        saved_content_parts.append(f"📄 **[附件文件: {doc['name']}]**")

    # Uploaded images are written to MEDIA_DIR and recorded by id; `content` keeps
    # only an /api/media/images/{id} reference. The inline base64 stays in
    # messages_payload above — the model needs it — but must not reach the row,
    # because every read of this conversation (message list, stats joins, sidebar)
    # would otherwise stream megabytes it never displays.
    stored_attachments = []
    for img in parsed_images:
        stored = store_uploaded_image(img["data_url"], img.get("name") or "图片")
        if stored:
            stored_attachments.append(stored)
            saved_content_parts.append(
                f"![{stored['name']}]({MEDIA_IMAGE_PATH_PREFIX}{stored['id']})"
            )
        else:
            # Storage unavailable. Keep the inline form so the attachment stays
            # visible — a fat row is strictly better than a silently missing image.
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
        # Tavily-only synthesized answer (see WebSearchOutcome.answer). None on
        # every DuckDuckGo fallback tier.
        search_answer: Optional[str] = None
        generated_images = []
        tool_invocations = []
        search_mode = (
            chat_req.web_search_mode
            or (user_settings.web_search_mode if user_settings else None)
            or "auto"
        )
        need_search, search_query, search_topic, search_time_range = should_search_web(chat_req.message, mode=search_mode)
        need_image_gen, img_prompt, img_size = should_generate_image(chat_req.message)
        # 'stop' | 'abort' | 'error' — persisted so the UI can tell a complete
        # reply apart from one the user cut short or that failed.
        finish_reason = "stop"
        error_text: Optional[str] = None
        # Flipped off when the iterator itself is being torn down, where any
        # further yield would raise "async generator ignored GeneratorExit".
        yield_allowed = True

        try:
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

            # 2. Check and execute automatic search before streaming LLM tokens
            if need_search and search_query:
                tool_call_id = f"call_{int(time.time() * 1000)}"
                logger.info(
                    "Executing web search for query: '%s' (mode=%s, topic=%s, time_range=%s)",
                    search_query, search_mode, search_topic, search_time_range
                )
                yield f"data: {json.dumps({'type': 'search_start', 'query': search_query}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'tool_call', 'toolCallId': tool_call_id, 'toolName': 'web_search', 'args': {'query': search_query}}, ensure_ascii=False)}\n\n"
                tool_invocations.append({
                    "toolCallId": tool_call_id,
                    "toolName": "web_search",
                    "args": {"query": search_query},
                    "state": "call",
                })
                try:
                    search_outcome = await web_search_service.search(
                        search_query, max_results=5, topic=search_topic, time_range=search_time_range
                    )
                    search_results = search_outcome.results
                    search_answer = search_outcome.answer
                except Exception as se:
                    logger.warning("Web search service failed for '%s': %s", search_query, str(se))
                    search_results = []
                    search_answer = None

                if tool_invocations:
                    tool_invocations[-1]["state"] = "result"
                    tool_invocations[-1]["result"] = search_results

                yield f"data: {json.dumps({'type': 'search_results', 'query': search_query, 'results': search_results, 'answer': search_answer}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'tool_result', 'toolCallId': tool_call_id, 'result': search_results}, ensure_ascii=False)}\n\n"

                if search_results or search_answer:
                    search_lines = [
                        f"\n\n【🌐 实时网络检索最新参考资料 (搜索词: {search_query})】"
                    ]
                    if search_answer:
                        search_lines.append(
                            "【检索系统综合摘要（由检索服务自动生成，可能存在偏差，仅供参考，请以下方逐条资料为准交叉验证）】\n"
                            f"{search_answer}"
                        )
                    if search_results:
                        search_lines.append(
                            "系统已自动联网检索到以下最新网页内容，请参考这些实时资料全面、准确、客观地回答用户，并在涉及具体事实时引用参考来源（例如 [1]、[2]）："
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

            token_iter = provider.chat(
                messages=messages_payload,
                model=model_to_use,
                stream=True,
                temperature=temperature
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

            # Capture upstream finish_reason from provider (e.g. length, content_filter, stop)
            if provider and getattr(provider, "last_finish_reason", None) and finish_reason == "stop":
                finish_reason = provider.last_finish_reason


        except asyncio.CancelledError:
            # The browser aborted the stream (stop button or navigation).
            # Keep whatever was produced so the partial answer is not lost.
            # Deliberately not re-raised: falling through lets the persist block
            # below save the partial reply with finish_reason='abort'.
            finish_reason = "abort"
            logger.info("Stream cancelled by client for conversation %s; persisting partial reply", conv_id)

        except GeneratorExit:
            # The response iterator itself is being closed. Persist the partial
            # reply as above, but never yield again from this path.
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

        # Fallback estimation when the provider did not report usage.
        #
        # Two things this block must not do:
        #
        # 1. Assume every content is a string. With an image attached the current
        #    turn's content is a LIST of multimodal parts (see the payload assembly
        #    above), and joining a list raises TypeError. That would abort the
        #    response right here — past the try/except, so with no "done" event
        #    and therefore a truncated reply on screen.
        # 2. Let a bookkeeping failure kill the stream. Token counts feed a stats
        #    table; they are not worth losing the user's answer over.
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

        # A failed or empty turn still deserves a durable record,
        # otherwise the conversation silently loses the attempt on reload.
        if not assistant_content.strip():
            if error_text:
                assistant_content = error_text
            elif finish_reason == "content_filter":
                assistant_content = "⚠️ 该提问触发了上游模型内容安全审核拦截（Content Filter），未返回有效回复内容。"
            elif finish_reason == "length":
                assistant_content = "⚠️ 模型在开始生成时即已达到单次最大 Token 限制，未能完成输出。"

        # Persist the assistant reply BEFORE signalling completion. The client
        # needs the row id to enable per-message actions (regenerate / delete)
        # right away; otherwise those buttons stay hidden until the conversation
        # is reloaded from the messages endpoint.
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
                        model=model_to_use,
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
            "model": model_to_use,
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
        }
        if yield_allowed:
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        # 10. Background housekeeping: conversation title + memory extraction
        if assistant_content.strip():
            # ── First turn of a conversation: replace the truncated first
            #    message with an LLM-written title so the sidebar reads well.
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

            # Schedule Mem0 extraction in non-blocking background executor.
            # Skipped for aborted turns: a cut-off answer can be a half-formed
            # sentence and must not become a long-term fact.
            if use_memory and finish_reason != "abort":
                # Strip reasoning thoughts (<think>...</think>) so scratchpad does not pollute user memory
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

                # ── Dreaming: count total messages in this conversation and
                #    trigger macro-level summarisation every DREAM_INTERVAL turns.
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
