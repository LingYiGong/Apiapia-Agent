import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.memory import MemoryUpdate, MemoryResponse, MemorySearchResponse
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.core.security import decode_access_token
from app.services.memory.service import memory_service

logger = logging.getLogger("memories_api")

router = APIRouter(prefix="/memories", tags=["memories"])


async def get_user_for_export(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(raw_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User deactivated")
    return user


@router.get("", response_model=List[Dict[str, Any]])
async def list_memories(
    current_user: User = Depends(get_current_user)
):
    """Retrieve all long-term memories belonging to current user."""
    memories = memory_service.list_memories(user_id=current_user.id)
    return memories


@router.get("/search", response_model=MemorySearchResponse)
async def search_memories(
    q: str = Query(..., min_length=1, description="Query to search within user's memories"),
    limit: int = Query(1000, ge=1, le=1000, description="Max results; default 1000 = no truncation"),
    current_user: User = Depends(get_current_user)
):
    """Semantic vector search across memories for current user.

    limit 默认 1000（= 不截断），与 list_memories 的 1000 和 service 层签名
    一致。此前这里是 `Query(10)`、service 默认 5、前端不传 —— 实际每次只返回
    5 条，而前端没有分页也没有「显示更多」，用户搜一个词只看到 5 条，
    很容易以为库里就这些。
    """
    results = memory_service.search_memory(user_id=current_user.id, query=q, limit=limit)
    return MemorySearchResponse(
        query=q,
        count=len(results),
        results=results
    )


@router.get("/export")
async def export_memories(
    current_user: User = Depends(get_user_for_export)
):
    """Export all user memories as JSON for data ownership and migration (Section 11 & 23)."""
    memories = memory_service.list_memories(user_id=current_user.id)
    return JSONResponse(
        content={
            "user_id": current_user.id,
            "username": current_user.username,
            "export_time": current_user.updated_at.isoformat() if current_user.updated_at else None,
            "total": len(memories),
            "memories": memories
        },
        headers={"Content-Disposition": f"attachment; filename=apiapia_memories_{current_user.username}.json"}
    )


@router.get("/{memory_id}")
async def get_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user)
):
    memory = memory_service.get_memory(user_id=current_user.id, memory_id=memory_id)
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
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
