from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime
import logging

from ..database.database import get_db
from ..database.crud import chat_history_crud
from ..schemas.chat_history import ChatHistory, ChatHistoryCreate
from ..auth.auth_bearer import get_required_user
from ..auth.auth_types import CurrentUser

logger = logging.getLogger(__name__)

chat_history_router = APIRouter()

@chat_history_router.post("", response_model=ChatHistory)
async def create_chat_history(
    chat_history: ChatHistoryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user)
):
    """创建新的聊天记录"""
    try:
        # 首先检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        paper_id = str(chat_history.paper_id)
        if paper_id in in_memory_papers:
            # 检查用户权限
            paper_data = in_memory_papers[paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # 对于内存存储的论文，我们暂时不保存聊天记录到数据库
            # 而是返回一个模拟的响应
            return ChatHistory(
                id=chat_history.id or "temp-id",
                paper_id=chat_history.paper_id,
                user_id=current_user.id,
                message=chat_history.message,
                role=chat_history.role,
                chat_type=chat_history.chat_type,
                thread_id=chat_history.thread_id,
                sequence=chat_history.sequence or 1,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        
        # 如果内存中没有，尝试数据库（向后兼容）
        # 但是这里需要确保论文确实存在于数据库中
        try:
            chat_history.user_id = current_user.id
            return chat_history_crud.create(db=db, chat_history=chat_history)
        except Exception as db_error:
            logger.error(f"Database error: {db_error}")
            raise HTTPException(status_code=404, detail="Paper not found in database")
        
    except Exception as e:
        logger.error(f"Error creating chat history: {e}")
        if "Paper not found" in str(e):
            raise HTTPException(status_code=404, detail="Paper not found")
        raise HTTPException(status_code=500, detail=f"Error creating chat history: {str(e)}")

@chat_history_router.get("/paper/{paper_id}", response_model=List[ChatHistory])
async def get_chat_histories(
    paper_id: str,
    chat_type: str,
    thread_id: str = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user)
):
    """获取指定论文的聊天记录"""
    return chat_history_crud.get_by_paper_and_user(
        db=db,
        paper_id=paper_id,
        user_id=str(current_user.id),
        chat_type=chat_type,
        thread_id=thread_id
    )

@chat_history_router.delete("/paper/{paper_id}")
async def delete_chat_histories(
    paper_id: str,
    chat_type: str,
    thread_id: str = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user)
):
    """删除指定论文的聊天记录"""
    success = chat_history_crud.delete_by_paper_and_user(
        db=db,
        paper_id=paper_id,
        user_id=str(current_user.id),
        chat_type=chat_type,
        thread_id=thread_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Chat histories not found") 