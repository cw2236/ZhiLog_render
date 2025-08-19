from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class ChatHistoryBase(BaseModel):
    paper_id: UUID
    chat_type: str  # 'overview' or 'comment'
    thread_id: Optional[str] = None
    role: str  # 'user' or 'assistant'
    message: str
    references: Optional[Dict[str, Any]] = None
    sequence: int

class ChatHistoryCreate(BaseModel):
    paper_id: UUID
    chat_type: str
    thread_id: Optional[str] = None
    role: str
    message: str
    references: Optional[Dict[str, Any]] = None
    sequence: int
    user_id: Optional[UUID] = None

class ChatHistory(ChatHistoryBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 