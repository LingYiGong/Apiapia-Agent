from typing import List, Optional
from datetime import datetime, timezone
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.config import settings as app_settings
from app.core.errors import ApiError
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.models.setting import UserSetting
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageResponse
)
from app.api.v1.deps import get_current_user, get_current_admin
from app.services.memory.retrieval import retrieve_relevant_memories
from app.services.memory.service import memory_service
from app.services.media_storage import media_storage

router = APIRouter(prefix="/conversations", tags=["conversations"])


async def _load_conversation(
    db: AsyncSession,
    conversation_id: str,
    user_id: Optional[str] = None,
    *,
    include_deleted: bool = False,
) -> Conversation:
    """Fetch one conversation, optionally scoped to its owner."""
    conditions = [Conversation.id == conversation_id]
    if user_id is not None:
        conditions.append(Conversation.user_id == user_id)
    if not include_deleted:
        conditions.append(Conversation.is_deleted == False)

    stmt = select(Conversation).where(*conditions)
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND, code="CONVERSATION_NOT_FOUND"
        )
    return conv


async def _require_conversation(
    db: AsyncSession,
    conversation_id: str,
    user: User,
    *,
    require_active: bool = True,
) -> Conversation:
    """Owner-scoped fetch for the routes a normal user can reach."""
    return await _load_conversation(
        db,
        conversation_id,
        user.id,
        include_deleted=not require_active,
    )


async def _ensure_last_message_at(db: AsyncSession, conv: Conversation) -> Conversation:
    """Backfill last_message_at if missing."""
    if conv.last_message_at:
        return conv
    last_msg_time = await db.scalar(
        select(func.max(Message.created_at)).where(Message.conversation_id == conv.id)
    )
    conv.last_message_at = last_msg_time or conv.created_at
    return conv


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Recycle bin is admin-only: ordinary users must not see any deleted items
    if include_deleted and not getattr(current_user, "is_superuser", False):
        raise ApiError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ADMIN_REQUIRED_RECYCLE_BIN",
        )

    last_msg_subq = (
        select(
            Message.conversation_id,
            func.max(Message.created_at).label("last_msg_time")
        )
        .group_by(Message.conversation_id)
        .subquery()
    )

    effective_last_msg = func.coalesce(
        Conversation.last_message_at,
        last_msg_subq.c.last_msg_time,
        Conversation.created_at
    )

    if include_deleted:
        # Admin cross-user recycle bin: all soft-deleted conversations with owner names
        stmt = (
            select(Conversation, User.username, effective_last_msg.label("computed_last_msg"))
            .join(User, User.id == Conversation.user_id)
            .outerjoin(last_msg_subq, last_msg_subq.c.conversation_id == Conversation.id)
            .where(Conversation.is_deleted == True)
            .order_by(Conversation.deleted_at.desc().nullslast())
        )
        rows = (await db.execute(stmt)).all()
        trashed = []
        for conv, username, comp_time in rows:
            conv.username = username
            conv.last_message_at = comp_time
            trashed.append(conv)
        return trashed

    stmt = (
        select(Conversation, effective_last_msg.label("computed_last_msg"))
        .outerjoin(last_msg_subq, last_msg_subq.c.conversation_id == Conversation.id)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.is_deleted == False
        )
        .order_by(
            Conversation.is_pinned.desc(),
            Conversation.pin_order.asc(),
            effective_last_msg.desc()
        )
    )
    rows = (await db.execute(stmt)).all()
    conversations = []
    for conv, comp_time in rows:
        conv.last_message_at = comp_time
        conversations.append(conv)
    return conversations


class PinOrderUpdate(BaseModel):
    ordered_ids: List[str]


@router.put("/pinned/order", response_model=List[ConversationResponse])
async def reorder_pinned_conversations(
    payload: PinOrderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually sort pinned conversations. ordered_ids = pinned ids top-to-bottom."""
    if not payload.ordered_ids:
        raise ApiError(status_code=status.HTTP_400_BAD_REQUEST, code="PINNED_IDS_EMPTY")

    stmt = select(Conversation).where(
        Conversation.user_id == current_user.id,
        Conversation.is_deleted == False,
        Conversation.is_pinned == True,
        Conversation.id.in_(payload.ordered_ids)
    )
    pinned = (await db.execute(stmt)).scalars().all()
    found = {c.id: c for c in pinned}
    missing = [cid for cid in payload.ordered_ids if cid not in found]
    if missing:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="PINNED_IDS_UNKNOWN",
            ids=", ".join(missing),
        )

    for index, cid in enumerate(payload.ordered_ids):
        found[cid].pin_order = index
        found[cid].updated_at = datetime.now(timezone.utc)

    await db.commit()
    for c in pinned:
        await _ensure_last_message_at(db, c)
    return sorted(pinned, key=lambda c: c.pin_order)


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
        model_to_use = user_settings.effective_default_model if user_settings else app_settings.DEFAULT_MODEL

    now = datetime.now(timezone.utc)
    conv = Conversation(
        user_id=current_user.id,
        title=conv_in.title or "新建对话",
        model=model_to_use,
        last_message_at=now
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
    conv = await _require_conversation(db, conversation_id, current_user)
    return await _ensure_last_message_at(db, conv)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    conv_in: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv = await _require_conversation(db, conversation_id, current_user)

    if conv_in.title is not None:
        conv.title = conv_in.title
    if conv_in.model is not None:
        conv.model = conv_in.model
    if conv_in.is_pinned is not None:
        # Pinning: append to the end unless an explicit pin_order is given
        if conv_in.is_pinned and not conv.is_pinned and conv_in.pin_order is None:
            max_order = await db.scalar(
                select(func.max(Conversation.pin_order)).where(
                    Conversation.user_id == current_user.id,
                    Conversation.is_deleted == False,
                    Conversation.is_pinned == True
                )
            )
            conv.pin_order = (max_order + 1) if max_order is not None else 0
        conv.is_pinned = conv_in.is_pinned
    if conv_in.pin_order is not None:
        conv.pin_order = conv_in.pin_order
    conv.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return await _ensure_last_message_at(db, conv)


@router.post("/{conversation_id}/pin", response_model=ConversationResponse)
async def pin_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pin a conversation (goes to the end of the pinned list)."""
    conv = await _require_conversation(db, conversation_id, current_user)

    if not conv.is_pinned:
        max_order = await db.scalar(
            select(func.max(Conversation.pin_order)).where(
                Conversation.user_id == current_user.id,
                Conversation.is_deleted == False,
                Conversation.is_pinned == True
            )
        )
        conv.is_pinned = True
        conv.pin_order = (max_order + 1) if max_order is not None else 0
        conv.updated_at = datetime.now(timezone.utc)
        await db.commit()
    return await _ensure_last_message_at(db, conv)


@router.delete("/{conversation_id}/pin", response_model=ConversationResponse)
async def unpin_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unpin a conversation."""
    conv = await _require_conversation(db, conversation_id, current_user)

    conv.is_pinned = False
    conv.pin_order = 0
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _ensure_last_message_at(db, conv)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Perform soft delete on conversation."""
    conv = await _require_conversation(db, conversation_id, current_user)

    conv.is_deleted = True
    conv.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None


@router.post("/{conversation_id}/restore", response_model=ConversationResponse)
async def restore_conversation(
    conversation_id: str,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: restore any user's soft-deleted conversation back to its owner's list."""
    conv = await _load_conversation(
        db, conversation_id, include_deleted=True
    )

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
    # Ownership check first; deliberately include_deleted so a user can still read
    # a conversation they themselves deleted until an admin restores it.
    await _require_conversation(db, conversation_id, current_user, require_active=False)

    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(msg_stmt)
    return result.scalars().all()


@router.delete("/{conversation_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    conversation_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a single message. Used by the per-message delete affordance."""
    await _require_conversation(db, conversation_id, current_user, require_active=False)
    msg = await _load_message(db, conversation_id, message_id)

    _purge_message_media(msg)
    await db.delete(msg)
    await _sync_conversation_timestamp(db, conversation_id)
    await db.commit()
    return None


@router.post("/{conversation_id}/messages/{message_id}/truncate")
async def truncate_from_message(
    conversation_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete message_id and every message after it (edit and resend branch rebuild)."""
    await _require_conversation(db, conversation_id, current_user, require_active=False)
    anchor = await _load_message(db, conversation_id, message_id)

    doomed = (
        await db.execute(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.created_at >= anchor.created_at
            )
        )
    ).scalars().all()

    removed = 0
    for m in doomed:
        _purge_message_media(m)
        await db.delete(m)
        removed += 1

    await _sync_conversation_timestamp(db, conversation_id)
    await db.commit()
    return {"deleted": removed}


async def _load_message(db: AsyncSession, conversation_id: str, message_id: str) -> Message:
    """Fetch a message and verify it belongs to the given conversation."""
    msg = await db.get(Message, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="MESSAGE_NOT_FOUND")
    return msg


def _purge_message_media(msg: Message) -> None:
    """Delete media files referenced by a message that is being removed."""
    for attribute in ("generated_images", "generated_videos", "user_attachments"):
        raw = getattr(msg, attribute, None)
        if not raw:
            continue
        try:
            entries = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            continue
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if isinstance(entry, dict) and entry.get("path"):
                media_storage.delete(entry["path"])


async def _sync_conversation_timestamp(db: AsyncSession, conversation_id: str) -> None:
    """Keep last_message_at pointing at the newest surviving message."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        return
    last = (
        await db.execute(
            select(func.max(Message.created_at)).where(Message.conversation_id == conversation_id)
        )
    ).scalar() or conv.created_at
    conv.last_message_at = last
    conv.updated_at = last


@router.get("/{conversation_id}/memories", response_model=List[dict])
async def get_conversation_memories(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve memories associated with or relevant to this conversation."""
    await _require_conversation(db, conversation_id, current_user, require_active=False)

    recalled_memories = []
    existing_ids = set()

    # 1. First check if any memory was directly extracted from this conversation (metadata.conversation_id)
    try:
        # Off the event loop: list_memories is synchronous and reads the whole
        # user's memory set out of pgvector. Inline it would stall every other
        # request this worker is serving.
        all_user_mems = await asyncio.to_thread(
            memory_service.list_memories, current_user.id
        )
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
            semantic_mems, _ = await asyncio.to_thread(
                retrieve_relevant_memories,
                user_id=current_user.id,
                query=last_user_msg.content,
                limit=5,
            )
            for sm in semantic_mems:
                sm_id = sm.get("id")
                if sm_id and sm_id not in existing_ids:
                    recalled_memories.append(sm)
                    existing_ids.add(sm_id)
        except Exception:
            pass

    return recalled_memories

