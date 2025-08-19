from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from sqlalchemy import func

from ..models import ChatHistory
from ...schemas.chat_history import ChatHistoryCreate

def create(db: Session, chat_history: ChatHistoryCreate) -> ChatHistory:
    """创建新的聊天记录"""
    # 确保 sequence 在 bigint 范围内
    max_sequence = db.query(func.max(ChatHistory.sequence)).filter(
        ChatHistory.paper_id == chat_history.paper_id,
        ChatHistory.user_id == chat_history.user_id,
        ChatHistory.chat_type == chat_history.chat_type
    ).scalar()
    chat_history.sequence = (max_sequence or 0) + 1

    db_chat_history = ChatHistory(**chat_history.model_dump())
    db.add(db_chat_history)
    db.commit()
    db.refresh(db_chat_history)
    return db_chat_history

def get_by_paper_and_user(
    db: Session,
    paper_id: str,
    user_id: str,
    chat_type: str,
    thread_id: Optional[str] = None
) -> List[ChatHistory]:
    """获取指定论文和用户的聊天记录"""
    # 将字符串转换为 UUID
    paper_uuid = UUID(paper_id)
    user_uuid = UUID(user_id)
    
    query = db.query(ChatHistory).filter(
        ChatHistory.paper_id == paper_uuid,
        ChatHistory.user_id == user_uuid,
        ChatHistory.chat_type == chat_type
    )
    
    if thread_id:
        query = query.filter(ChatHistory.thread_id == thread_id)
    
    return query.order_by(ChatHistory.sequence).all()

def delete_by_paper_and_user(
    db: Session,
    paper_id: str,
    user_id: str,
    chat_type: str,
    thread_id: Optional[str] = None
) -> bool:
    """删除指定论文和用户的聊天记录"""
    # 将字符串转换为 UUID
    paper_uuid = UUID(paper_id)
    user_uuid = UUID(user_id)
    
    query = db.query(ChatHistory).filter(
        ChatHistory.paper_id == paper_uuid,
        ChatHistory.user_id == user_uuid,
        ChatHistory.chat_type == chat_type
    )
    
    if thread_id:
        query = query.filter(ChatHistory.thread_id == thread_id)
    
    count = query.delete()
    db.commit()
    return count > 0 