import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Dict, Any
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
from app.services.llm.factory import get_llm_provider
from app.services.memory.retrieval import retrieve_relevant_memories
from app.services.memory.extraction import schedule_memory_extraction
from app.services.memory.dreaming import schedule_dreaming
from app.services.document_parser import parse_attachment, fetch_and_parse_url, extract_urls
from app.services.search import web_search_service, should_search_web
from app.services.prompt import build_system_prompt
from app.services.deterministic import evaluate_deterministic_context
from app.core.security import decrypt_api_key

router = APIRouter(prefix="/chat", tags=["chat"])

logger = logging.getLogger("chat_api")


def estimate_token_count(text: str) -> int:
    """Accurately estimate token count for multi-lingual text (Chinese + English)."""
    if not text:
        return 0
    zh_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - zh_chars
    return max(1, int(zh_chars * 1.3 + other_chars / 4))


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
        import re
        clean_mem_msg = re.sub(r"https?://[^\s<>\"'()]+", "", chat_req.message or "").strip()
        mem_query = clean_mem_msg if clean_mem_msg else (parsed_docs[0]['name'] if parsed_docs else "")
        if mem_query:
            retrieved_memories, memory_context_str = retrieve_relevant_memories(
                user_id=user_id,
                query=mem_query,
                limit=5
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
            import re
            cleaned_content = re.sub(r"!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^)]+\)", r"[附图: \1]", cleaned_content)
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
    for img in parsed_images:
        saved_content_parts.append(f"![{img['name']}]({img['data_url']})")
    saved_user_content = "\n\n".join(saved_content_parts) if saved_content_parts else (chat_req.message or "附件")

    user_msg_record = Message(
        conversation_id=conv_id,
        role="user",
        content=saved_user_content,
        model=model_to_use,
        prompt_tokens=user_tokens,
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
        search_mode = chat_req.web_search_mode or "auto"
        need_search, search_query, search_topic, search_time_range = should_search_web(chat_req.message, mode=search_mode)

        try:
            # Check and execute automatic search before streaming LLM tokens
            if need_search and search_query:
                logger.info(
                    "Executing web search for query: '%s' (mode=%s, topic=%s, time_range=%s)",
                    search_query, search_mode, search_topic, search_time_range
                )
                yield f"data: {json.dumps({'type': 'search_start', 'query': search_query}, ensure_ascii=False)}\n\n"
                try:
                    search_results = await web_search_service.search(
                        search_query, max_results=5, topic=search_topic, time_range=search_time_range
                    )
                except Exception as se:
                    logger.warning("Web search service failed for '%s': %s", search_query, str(se))
                    search_results = []

                yield f"data: {json.dumps({'type': 'search_results', 'query': search_query, 'results': search_results}, ensure_ascii=False)}\n\n"

                if search_results:
                    search_lines = [
                        f"\n\n【🌐 实时网络检索最新参考资料 (搜索词: {search_query})】",
                        "系统已自动联网检索到以下最新网页内容，请参考这些实时资料全面、准确、客观地回答用户，并在涉及具体事实时引用参考来源（例如 [1]、[2]）：",
                    ]
                    for idx, r in enumerate(search_results, 1):
                        search_lines.append(f"[{idx}] 《{r['title']}》\n    网址: {r['url']}\n    内容摘要: {r['snippet']}")
                    search_context_str = "\n".join(search_lines)

                    if messages_payload and messages_payload[0].get("role") == "system":
                        messages_payload[0]["content"] += search_context_str
                    else:
                        messages_payload.insert(0, {"role": "system", "content": search_context_str})

            # First send metadata chunk containing conversation_id and retrieved memories
            meta_chunk = {
                "type": "meta",
                "conversation_id": conv_id,
                "model": model_to_use,
                "retrieved_memories": retrieved_memories,
                "search_results": search_results if search_results else None,
                "created_at": user_created_at.isoformat()
            }
            yield f"data: {json.dumps(meta_chunk, ensure_ascii=False, default=str)}\n\n"

            # Obtain LLM Provider (uses backend .env configuration strictly)
            provider = get_llm_provider(
                provider=chat_req.provider,
                model=model_to_use
            )

            # Stream LLM generation tokens
            async for token in provider.chat(
                messages=messages_payload,
                model=model_to_use,
                stream=True,
                temperature=temperature
            ):
                if first_token_time is None:
                    first_token_time = time.time()
                full_assistant_reply.append(token)
                delta_payload = {
                    "type": "content",
                    "conversation_id": conv_id,
                    "delta": token
                }
                yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"

        except Exception as e:
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

            full_error_text = "\n\n".join(details)
            logger.error("Error during LLM streaming for user %s: %s", user_id, full_error_text, exc_info=True)

            error_payload = {
                "type": "error",
                "conversation_id": conv_id,
                "error": full_error_text
            }
            yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
            return

        # 9. Calculate latency, reply time and accurate token stats
        duration_ms = max(20, int((time.time() - start_time) * 1000))
        thinking_duration_ms = max(0, int((first_token_time - start_time) * 1000)) if first_token_time else duration_ms
        reply_created_at = datetime.now(timezone.utc)
        assistant_content = "".join(full_assistant_reply)

        usage = getattr(provider, "last_usage", None) or {}
        prompt_tokens = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")

        # Fallback estimation if provider stream didn't include usage
        if not prompt_tokens:
            prompt_text = " ".join([m.get("content", "") for m in messages_payload])
            prompt_tokens = estimate_token_count(prompt_text)

        if not completion_tokens:
            completion_tokens = estimate_token_count(assistant_content)

        total_tokens = prompt_tokens + completion_tokens

        # Signal completion with complete metadata
        done_payload = {
            "type": "done",
            "conversation_id": conv_id,
            "model": model_to_use,
            "duration_ms": duration_ms,
            "thinking_duration_ms": thinking_duration_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "created_at": reply_created_at.isoformat(),
            "search_results": search_results if search_results else None
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        # 10. Persist assistant reply to DB & trigger background memory extraction
        if assistant_content.strip():
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
                    search_results=json.dumps(search_results, ensure_ascii=False) if search_results else None,
                    created_at=reply_created_at
                )
                save_db.add(assistant_msg_record)
                await save_db.commit()

            # Schedule Mem0 extraction in non-blocking background executor
            if use_memory:
                # Strip reasoning thoughts (<think>...</think>) so scratchpad does not pollute user memory
                clean_assistant = assistant_content
                if "<think>" in clean_assistant:
                    import re
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
                    metadata={"conversation_id": conv_id},
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
