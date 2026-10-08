from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class MemoryUpdate(BaseModel):
    data: str
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
    #: 检索命中的**总**条数（不是本页条数）。注意这是下界：向量检索一次最多返回
    #: want 条，真实命中数未知。前端 MemoryView 只读 total / results / has_more。
    total: int
    results: List[Dict[str, Any]]
    has_more: bool
