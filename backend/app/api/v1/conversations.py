from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.models.setting import UserSetting
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageResponse
)
from app.api.v1.deps import get_current_user
from app.services.memory.retrieval import retrieve_relevant_memories
from app.services.memory.service import memory_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    where_clauses = [Conversation.user_id == current_user.id]
    if not include_deleted:
        where_clauses.append(Conversation.is_deleted == False)

    stmt = (
        select(Conversation)
        .where(*where_clauses)
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    conv_in: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    model_to_use = conv_in.model
    if not model_to_use:
        settings_stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
        user_settings = (await db.execute(settings_stmt)).scalar_one_or_none()
        model_to_use = user_settings.default_model if user_settings else "gpt-4o-mini"

    conv = Conversation(
        user_id=current_user.id,
        title=conv_in.title or "新建对话",
        model=model_to_use
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_deleted == False
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    conv_in: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_deleted == False
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if conv_in.title is not None:
        conv.title = conv_in.title
    if conv_in.model is not None:
        conv.model = conv_in.model
    conv.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(conv)
    return conv


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL: Perform SOFT DELETE instead of physical purge.
    Preserves all messages, token counts, and audit logs while hiding it from user's active list.
    """
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_deleted == False
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv.is_deleted = True
    conv.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None


@router.post("/{conversation_id}/restore", response_model=ConversationResponse)
async def restore_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a previously soft-deleted conversation."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv.is_deleted = False
    conv.deleted_at = None
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify conversation belongs to user
    conv_stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    conv = (await db.execute(conv_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(msg_stmt)
    return result.scalars().all()


@router.get("/{conversation_id}/memories", response_model=List[dict])
async def get_conversation_memories(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve memories associated with or relevant to this conversation."""
    conv_stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    conv = (await db.execute(conv_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    recalled_memories = []
    existing_ids = set()

    # 1. First check if any memory was directly extracted from this conversation (metadata.conversation_id)
    try:
        all_user_mems = memory_service.list_memories(user_id=current_user.id)
        for mem in all_user_mems:
            meta = mem.get("metadata") or {}
            if isinstance(meta, dict) and meta.get("conversation_id") == conversation_id:
                mem_id = mem.get("id")
                if mem_id and mem_id not in existing_ids:
                    recalled_memories.append({
                        "id": str(mem_id),
                        "memory": mem.get("memory") or mem.get("text") or str(mem),
                        "score": None
                    })
                    existing_ids.add(mem_id)
    except Exception:
        pass

    # 2. Then retrieve memories relevant to the latest user message in this conversation
    msg_stmt = (
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.role == "user"
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_user_msg = (await db.execute(msg_stmt)).scalar_one_or_none()

    if last_user_msg and last_user_msg.content.strip():
        try:
            semantic_mems, _ = retrieve_relevant_memories(
                user_id=current_user.id,
                query=last_user_msg.content,
                limit=5
            )
            for sm in semantic_mems:
                sm_id = sm.get("id")
                if sm_id and sm_id not in existing_ids:
                    recalled_memories.append(sm)
                    existing_ids.add(sm_id)
        except Exception:
            pass

    return recalled_memories

