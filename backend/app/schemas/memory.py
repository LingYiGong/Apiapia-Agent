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


class MemoryPageResponse(BaseModel):
    """分页后的记忆列表。

    total 是全量条数（不是本页条数），供前端显示「共 N 条」；
    has_more 供前端判断是否还有下一页，省掉一次多余的请求。
    """
    items: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int
    has_more: bool


class MemorySearchResponse(BaseModel):
    query: str
    #: 与 total 同值，保留是为了兼容既有调用方（此前 count = len(results)）
    count: int
    #: 检索命中的**总**条数，不是本页条数
    total: int
    results: List[Dict[str, Any]]
    has_more: bool
