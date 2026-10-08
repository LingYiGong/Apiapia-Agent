import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from app.models.user import User
from app.schemas.memory import (
    MemoryUpdate,
    MemorySearchResponse,
    MemoryPageResponse,
)
from app.api.v1.deps import get_current_user, get_current_user_allow_query_token
from app.services.memory.service import memory_service

logger = logging.getLogger("memories_api")

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=MemoryPageResponse)
async def list_memories(
    limit: int = Query(50, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of memories to skip"),
    current_user: User = Depends(get_current_user)
):
    """Retrieve long-term memories belonging to current user, paginated.

    默认页大小 50，与前端 PAGE_SIZE 一致。

    排序：按最近变化时间（updated_at 优先，回落 created_at）倒序，在
    service 层完成；同时间戳用 id 作次级键保证全序，因此 offset 分页不会
    漏条目或重复。

    ⚠️ 响应体形状是带 items 的对象（此前是裸 list），属破坏性变更。
    目前唯一的前端调用方是 MemoryView.tsx。
    """
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
    """Semantic vector search across memories for current user, paginated.

    检索只负责决定「哪些记忆相关」；返回给前端后由前端按时间重新分组排序，
    所以这里的向量排序顺序不影响最终展示顺序 —— 相关度仅用于决定召回哪些。

    分页在此之上切片。切片会破坏跨页的相关度连续性（第 2 页首条可能不如
    第 1 页末条相关），这是相似度排序下 offset 分页的固有性质；由于前端
    会重排，这个瑕疵不会出现在界面上。
    """
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
    """Export all user memories as JSON for data ownership and migration (Section 11 & 23).

    ⚠️ 必须导出**全量**。此前这里复用 list_memories（上限 1000），记忆超过
    1000 条时导出的 JSON 会被静默截断 —— 而这是用户唯一的数据自主出口
    （README 明确承诺「一键导出 JSON 实现个人数据完全自主」），静默残缺的
    备份比不提供更糟。现在走 list_all_memories，不设条数上限。
    """
    memories = await asyncio.to_thread(
        memory_service.list_all_memories, user_id=current_user.id
    )
    return JSONResponse(
        content={
            "user_id": current_user.id,
            "username": current_user.username,
            # When the export ran. This used to be current_user.updated_at — the
            # last time the *account row* changed — so an export taken today after
            # a settings edit six weeks ago was labelled with that edit date.
            "export_time": datetime.now(timezone.utc).isoformat(),
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
