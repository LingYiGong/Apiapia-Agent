import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.setting import UserSetting
from app.core.errors import ApiError
from app.models.user import User
from app.schemas.memory import (
    MemoryUpdate,
    MemorySearchResponse,
    MemoryPageResponse,
    ConsolidationPreviewResponse,
    ConsolidationApplyRequest,
    ConsolidationApplyResponse,
    ConsolidationSnapshotStatus,
)
from app.api.v1.deps import get_current_user, get_current_user_allow_query_token
from app.services.memory.service import memory_service
from app.services.memory.consolidation import (
    preview_consolidation,
    apply_consolidation,
    rollback_consolidation,
    get_snapshot_status,
)

logger = logging.getLogger("memories_api")

router = APIRouter(prefix="/memories", tags=["memories"])



@router.get("", response_model=MemoryPageResponse)
async def list_memories(
    limit: int = Query(50, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of memories to skip"),
    current_user: User = Depends(get_current_user)
):
    """Retrieve long-term memories belonging to current user, paginated."""
    page = await asyncio.to_thread(
        memory_service.list_memories_page,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return MemoryPageResponse(**page)


@router.get("/search", response_model=MemorySearchResponse)
async def search_memories(
    q: str = Query(..., min_length=1, description="Query to search within user's memories"),
    limit: int = Query(50, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user)
):
    """Semantic vector search across memories for current user, paginated."""
    page = await asyncio.to_thread(
        memory_service.search_memory_page,
        user_id=current_user.id,
        query=q,
        limit=limit,
        offset=offset,
    )
    return MemorySearchResponse(
        query=q,
        total=page["total"],
        results=page["items"],
        has_more=page["has_more"],
    )


@router.get("/export")
async def export_memories(
    current_user: User = Depends(get_current_user_allow_query_token)
):
    """Export all user memories as JSON."""
    memories = await asyncio.to_thread(
        memory_service.list_all_memories, user_id=current_user.id
    )
    return JSONResponse(
        content={
            "user_id": current_user.id,
            "username": current_user.username,
            "export_time": datetime.now(timezone.utc).isoformat(),
            "total": len(memories),
            "memories": memories
        },
        headers={"Content-Disposition": f"attachment; filename=apiapia_memories_{current_user.username}.json"}
    )


@router.post("/consolidate/preview", response_model=ConsolidationPreviewResponse)
async def preview_memory_consolidation(
    model: Optional[str] = Query(None, description="Optional LLM model override for consolidation"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze all user memories and generate a proposed consolidation plan (Diff)."""
    chosen_model = model
    if not chosen_model:
        stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
        res = await db.execute(stmt)
        user_setting = res.scalar_one_or_none()
        if user_setting:
            chosen_model = (
                user_setting.consolidation_model
                or user_setting.effective_default_model
                or user_setting.memory_model
            )

    result = await asyncio.to_thread(
        preview_consolidation,
        user_id=current_user.id,
        memory_model=chosen_model
    )
    return ConsolidationPreviewResponse(**result)


@router.post("/consolidate/apply", response_model=ConsolidationApplyResponse)
async def apply_memory_consolidation(
    payload: ConsolidationApplyRequest,
    current_user: User = Depends(get_current_user)
):
    """Apply the approved consolidation plan to the database (with auto snapshot)."""
    try:
        result = await asyncio.to_thread(
            apply_consolidation,
            user_id=current_user.id,
            approved_plan=payload.plan.model_dump()
        )
        return ConsolidationApplyResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/consolidate/rollback")
async def rollback_memory_consolidation(
    current_user: User = Depends(get_current_user)
):
    """Roll back the last memory consolidation to its pre-consolidation snapshot."""
    try:
        result = await asyncio.to_thread(
            rollback_consolidation,
            user_id=current_user.id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/consolidate/snapshot-status", response_model=ConsolidationSnapshotStatus)
async def check_consolidation_snapshot_status(
    current_user: User = Depends(get_current_user)
):
    """Check if a rollback snapshot is available for the current user."""
    status_info = get_snapshot_status(user_id=current_user.id)
    return ConsolidationSnapshotStatus(**status_info)


@router.get("/{memory_id}")
async def get_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user)
):
    memory = memory_service.get_memory(user_id=current_user.id, memory_id=memory_id)
    if not memory:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="MEMORY_NOT_FOUND")
    return memory


@router.patch("/{memory_id}")
async def update_memory(
    memory_id: str,
    memory_in: MemoryUpdate,
    current_user: User = Depends(get_current_user)
):
    """Correct or update an existing memory."""
    try:
        updated = memory_service.update_memory(
            user_id=current_user.id,
            memory_id=memory_id,
            data=memory_in.data,
            metadata=memory_in.metadata
        )
        return {"status": "success", "result": updated}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a specific memory."""
    try:
        memory_service.delete_memory(user_id=current_user.id, memory_id=memory_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
