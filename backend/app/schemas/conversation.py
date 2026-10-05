from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class MessageBase(BaseModel):
    role: str
    content: str
    model: Optional[str] = None


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: str
    conversation_id: str
    token_usage: Optional[int] = 0
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0
    duration_ms: Optional[int] = 0
    search_results: Optional[str] = None
    generated_images: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    title: Optional[str] = "新建对话"
    model: Optional[str] = "gpt-4o-mini"
    is_pinned: Optional[bool] = False
    pin_order: Optional[int] = 0


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    is_pinned: Optional[bool] = None
    pin_order: Optional[int] = None


class ConversationResponse(ConversationBase):
    id: str
    user_id: str
    username: Optional[str] = None  # Owner name, populated only by admin recycle-bin listing
    is_deleted: Optional[bool] = False
    deleted_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: Optional[List[MessageResponse]] = []
