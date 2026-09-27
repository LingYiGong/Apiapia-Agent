import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.models.setting import UserSetting, ModelConfig
from app.schemas.chat import ChatRequest
from app.api.v1.deps import get_current_user
from app.services.llm.factory import get_llm_provider
from app.services.memory.retrieval import retrieve_relevant_memories
from app.services.memory.extraction import schedule_memory_extraction
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

    # 1. Fetch or create conversation
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
        conversation.updated_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        # Create new conversation with title generated from user input
        conv_title = (chat_req.message[:30] + "...") if len(chat_req.message) > 30 else chat_req.message
        conversation = Conversation(
            user_id=user_id,
            title=conv_title.strip() or "新建对话",
            model=chat_req.model or "gpt-4o-mini"
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    conv_id = conversation.id

    # 2. Fetch User Settings
    settings_stmt = select(UserSetting).where(UserSetting.user_id == user_id)
    user_settings = (await db.execute(settings_stmt)).scalar_one_or_none()

    system_prompt = user_settings.system_prompt if user_settings else "你是一个智能、真诚、有洞察力的私人 AI 助理。"
    model_to_use = chat_req.model or (user_settings.default_model if user_settings else "gpt-4o-mini")
    temperature = chat_req.temperature if chat_req.temperature is not None else (user_settings.temperature if user_settings else 0.7)
    use_memory = chat_req.memory_enabled if chat_req.memory_enabled is not None else (user_settings.memory_enabled if user_settings else True)

    # 3. Retrieve relevant long-term memories if enabled
    retrieved_memories = []
    memory_context_str = ""
    if use_memory:
        retrieved_memories, memory_context_str = retrieve_relevant_memories(
            user_id=user_id,
            query=chat_req.message,
            limit=5
        )

    # 4. Fetch recent conversation messages
    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    recent_msgs = (await db.execute(msg_stmt)).scalars().all()
    recent_msgs.reverse()  # chronological order

    # 5. Assemble messages payload for LLM Adapter
    messages_payload = []
    # Combine system prompt with untrusted memory context
    combined_system_content = system_prompt + memory_context_str
    messages_payload.append({"role": "system", "content": combined_system_content})

    for msg in recent_msgs:
        messages_payload.append({"role": msg.role, "content": msg.content})

    messages_payload.append({"role": "user", "content": chat_req.message})

    # 6. Save current user message to DB
    user_created_at = datetime.now(timezone.utc)
    user_tokens = estimate_token_count(chat_req.message)
    user_msg_record = Message(
        conversation_id=conv_id,
        role="user",
        content=chat_req.message,
        model=model_to_use,
        prompt_tokens=user_tokens,
        created_at=user_created_at
    )
    db.add(user_msg_record)
    await db.commit()

    # 7. Check if user configured custom API key for this model/provider
    custom_key = None
    custom_base_url = None
    config_stmt = select(ModelConfig).where(
        ModelConfig.user_id == user_id,
        ModelConfig.model == model_to_use,
        ModelConfig.enabled == True
    )
    custom_cfg = (await db.execute(config_stmt)).scalar_one_or_none()
    if custom_cfg:
        custom_key = decrypt_api_key(custom_cfg.api_key_encrypted)
        custom_base_url = custom_cfg.base_url

    # 8. SSE Streaming generator with FULL error capture
    async def sse_event_stream() -> AsyncGenerator[str, None]:
        full_assistant_reply = []
        start_time = time.time()
        first_token_time = None
        provider = None

        try:
            # First send metadata chunk containing conversation_id and retrieved memories
            meta_chunk = {
                "type": "meta",
                "conversation_id": conv_id,
                "model": model_to_use,
                "retrieved_memories": retrieved_memories,
                "created_at": user_created_at.isoformat()
            }
            yield f"data: {json.dumps(meta_chunk, ensure_ascii=False, default=str)}\n\n"

            # Obtain LLM Provider inside stream so configuration errors are also returned to chat window
            provider = get_llm_provider(
                provider=chat_req.provider,
                model=model_to_use,
                api_key=custom_key,
                base_url=custom_base_url
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
            "created_at": reply_created_at.isoformat()
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

                assistant_msg_record = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=assistant_content,
                    model=model_to_use,
                    token_usage=total_tokens,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    duration_ms=duration_ms,
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

                conversation_pair = [
                    {"role": "user", "content": chat_req.message},
                    {"role": "assistant", "content": clean_assistant}
                ]
                memory_model_to_use = getattr(user_settings, "memory_model", None) or "openai/gpt-4o-mini"
                await schedule_memory_extraction(
                    user_id=user_id,
                    messages=conversation_pair,
                    metadata={"conversation_id": conv_id},
                    memory_model=memory_model_to_use
                )

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
