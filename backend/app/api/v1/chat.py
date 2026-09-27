import json
import logging
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
            Conversation.user_id == user_id
        )
        conversation = (await db.execute(stmt)).scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or access denied"
            )
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
    user_msg_record = Message(
        conversation_id=conv_id,
        role="user",
        content=chat_req.message,
        model=model_to_use
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

        try:
            # First send metadata chunk containing conversation_id and retrieved memories
            meta_chunk = {
                "type": "meta",
                "conversation_id": conv_id,
                "model": model_to_use,
                "retrieved_memories": retrieved_memories
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
                full_assistant_reply.append(token)
                delta_payload = {
                    "type": "content",
                    "conversation_id": conv_id,
                    "delta": token
                }
                yield f"data: {json.dumps(delta_payload, ensure_ascii=False)}\n\n"

            # Signal completion
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id})}\n\n"

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

        # 10. Persist assistant reply to DB & trigger background memory extraction
        assistant_content = "".join(full_assistant_reply)
        if assistant_content.strip():
            async with AsyncSessionLocal() as save_db:
                assistant_msg_record = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=assistant_content,
                    model=model_to_use
                )
                save_db.add(assistant_msg_record)
                await save_db.commit()

            # Schedule Mem0 extraction in non-blocking background executor
            if use_memory:
                conversation_pair = [
                    {"role": "user", "content": chat_req.message},
                    {"role": "assistant", "content": assistant_content}
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
