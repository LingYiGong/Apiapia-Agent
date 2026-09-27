from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    model: Optional[str] = None
    provider: Optional[str] = None
    stream: bool = True
    temperature: Optional[float] = None
    memory_enabled: Optional[bool] = True


class ChatStreamChunk(BaseModel):
    id: Optional[str] = None
    conversation_id: str
    delta: str
    done: bool = False
    model: Optional[str] = None
    retrieved_memories: Optional[List[Dict[str, Any]]] = None
