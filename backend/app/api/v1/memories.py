from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from app.models.user import User
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse, MemorySearchResponse
from app.api.v1.deps import get_current_user
from app.services.memory.service import memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=List[Dict[str, Any]])
async def list_memories(
    current_user: User = Depends(get_current_user)
):
    """Retrieve all long-term memories belonging to current user."""
    memories = memory_service.list_memories(user_id=current_user.id)
    return memories


@router.get("/search", response_model=MemorySearchResponse)
async def search_memories(
    q: str = Query(..., description="Query to search within user's memories"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """Semantic vector search across memories for current user."""
    results = memory_service.search_memory(user_id=current_user.id, query=q, limit=limit)
    return MemorySearchResponse(
        query=q,
        count=len(results),
        results=results
    )


@router.get("/export")
async def export_memories(
    current_user: User = Depends(get_current_user)
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
        headers={"Content-Disposition": f"attachment; filename=personal_ai_memories_{current_user.username}.json"}
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


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_memory(
    memory_in: MemoryCreate,
    current_user: User = Depends(get_current_user)
):
    """Manually add a memory item."""
    result = memory_service.add_memory(
        user_id=current_user.id,
        data=memory_in.data,
        metadata=memory_in.metadata
    )
    return {"status": "success", "result": result}


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
