from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class MemoryCreate(BaseModel):
    data: str
    metadata: Optional[Dict[str, Any]] = None


class MemoryUpdate(BaseModel):
    data: str
    metadata: Optional[Dict[str, Any]] = None


class MemoryResponse(BaseModel):
    id: str
    memory: str
    user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MemorySearchResponse(BaseModel):
    query: str
    count: int
    results: List[Dict[str, Any]]
