from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class AttachmentPayload(BaseModel):
    name: str
    type: str  # "image" or "document"
    mime_type: Optional[str] = "application/octet-stream"
    data_url: str  # base64 data url: "data:...;base64,..."


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    model: Optional[str] = None
    provider: Optional[str] = None
    stream: bool = True
    temperature: Optional[float] = None
    memory_enabled: Optional[bool] = True
    web_search_mode: Optional[str] = "auto"  # "auto", "on", "off"
    attachments: Optional[List[AttachmentPayload]] = []


class ChatStreamChunk(BaseModel):
    id: Optional[str] = None
    conversation_id: str
    delta: str
    done: bool = False
    model: Optional[str] = None
    retrieved_memories: Optional[List[Dict[str, Any]]] = None
    search_results: Optional[List[Dict[str, Any]]] = None
