from pydantic import BaseModel
from typing import Optional, Dict, Any


class MemoryItem(BaseModel):
    id: str
    memory: str
    user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    score: Optional[float] = None
