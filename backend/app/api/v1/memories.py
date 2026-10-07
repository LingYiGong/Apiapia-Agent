import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.memory import (
    MemoryUpdate,
    MemoryResponse,
    MemorySearchResponse,
    MemoryPageResponse,
)
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


@router.get("", response_model=MemoryPageResponse)
async def list_memories(
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of memories to skip"),
    current_user: User = Depends(get_current_user)
):
    """Retrieve long-term memories belonging to current user, paginated.

    此前本接口无分页参数，直接返回 list_memories 的全量结果（上限 1000）。
    改为分页后返回 {items, total, limit, offset, has_more}，前端据此下滑加载。

    ⚠️ 响应体形状变了（list → 带 items 的对象）。这是**破坏性变更**，
    所有消费方必须改读 `.items`；目前唯一的前端调用方是 MemoryView.tsx。
    """
    page = memory_service.list_memories_page(
        user_id=current_user.id, limit=limit, offset=offset
    )
    return MemoryPageResponse(**page)


@router.get("/search", response_model=MemorySearchResponse)
async def search_memories(
    q: str = Query(..., min_length=1, description="Query to search within user's memories"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_current_user)
):
    """Semantic vector search across memories for current user, paginated.

    结果按向量相似度排序。分页在此之上切片 —— 注意切片**会破坏**跨页的
    相关度连续性（第 2 页的第 1 条可能比第 1 页最后一条更不相关），这是
    offset 分页在相似度排序下的固有性质，可接受。

    历史沿革：limit 曾在路由默认 10、service 默认 5、前端不传，实际每次只回
    5 条。现统一由前端显式传 page size。
    """
    page = memory_service.search_memory_page(
        user_id=current_user.id, query=q, limit=limit, offset=offset
    )
    return MemorySearchResponse(
        query=q,
        count=page["total"],
        total=page["total"],
        results=page["items"],
        has_more=page["has_more"],
    )


@router.get("/export")
async def export_memories(
    current_user: User = Depends(get_user_for_export)
):
    """Export all user memories as JSON for data ownership and migration (Section 11 & 23).

    ⚠️ 必须导出**全量**。此前这里复用 list_memories（上限 1000），记忆超过
    1000 条时导出的 JSON 会被静默截断 —— 而这是用户唯一的数据自主出口
    （README 明确承诺「一键导出 JSON 实现个人数据完全自主」），静默残缺的
    备份比不提供更糟。现在走 list_all_memories，不设条数上限。
    """
    memories = memory_service.list_all_memories(user_id=current_user.id)
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
