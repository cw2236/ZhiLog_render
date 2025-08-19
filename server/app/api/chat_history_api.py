from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from ..database.session import get_db
from ..database.crud import chat_history_crud
from ..schemas.chat_history import ChatHistory, ChatHistoryCreate
from ..auth.auth_bearer import get_required_user
from ..auth.auth_types import CurrentUser

chat_history_router = APIRouter()

@chat_history_router.post("", response_model=ChatHistory)
async def create_chat_history(
    chat_history: ChatHistoryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user)
):
    """创建新的聊天记录"""
    chat_history.user_id = current_user.id
    return chat_history_crud.create(db=db, chat_history=chat_history)

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