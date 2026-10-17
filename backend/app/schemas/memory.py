from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class MemoryUpdate(BaseModel):
    data: str
    metadata: Optional[Dict[str, Any]] = None


class MemoryPageResponse(BaseModel):
    """分页后的记忆列表。"""
    items: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int
    has_more: bool


class MemorySearchResponse(BaseModel):
    query: str
    total: int
    results: List[Dict[str, Any]]
    has_more: bool


class ConsolidationPlanItem(BaseModel):
    id: Optional[str] = None
    text: str
    old_text: Optional[str] = None
    category: Optional[str] = None
    importance: Optional[int] = None
    reason: Optional[str] = None


class ConsolidationPlan(BaseModel):
    to_delete: List[Dict[str, Any]] = []
    to_update: List[Dict[str, Any]] = []
    to_add: List[Dict[str, Any]] = []
    to_keep: List[Dict[str, Any]] = []


class ConsolidationPreviewResponse(BaseModel):
    status: str
    message: Optional[str] = None
    total_count: Optional[int] = None
    summary: Optional[str] = None
    plan: Optional[ConsolidationPlan] = None


class ConsolidationApplyRequest(BaseModel):
    plan: ConsolidationPlan


class ConsolidationApplyResponse(BaseModel):
    status: str
    deleted_count: int
    updated_count: int
    added_count: int
    snapshot_created: bool


class ConsolidationSnapshotStatus(BaseModel):
    has_snapshot: bool
    snapshot_time: Optional[str] = None
    count: int

