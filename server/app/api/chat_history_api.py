import logging
import uuid
from datetime import datetime
from typing import List, Optional

from app.auth.dependencies import get_current_user, get_required_user
from app.schemas.user import CurrentUser
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create API router
chat_history_router = APIRouter()

# 内存存储聊天历史
in_memory_chat_history = {}


class ChatHistoryCreate(BaseModel):
    paper_id: str
    message: str
    role: str = "user"
    chat_type: str = "comment"
    thread_id: Optional[str] = None
    sequence: Optional[int] = None


class ChatHistory(BaseModel):
    id: str
    paper_id: str
    user_id: str
    message: str
    role: str
    chat_type: str
    thread_id: Optional[str] = None
    sequence: Optional[int] = None
    created_at: datetime
    updated_at: datetime


@chat_history_router.post("", response_model=ChatHistory)
async def create_chat_history(
    chat_history: ChatHistoryCreate,
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
):
    """创建新的聊天记录"""
    try:
        # 检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        paper_id = str(chat_history.paper_id)
        if paper_id not in in_memory_papers:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # 检查用户权限 - 暂时跳过，使用模拟用户ID
        # paper_data = in_memory_papers[paper_id]
        # if paper_data.get("user_id") != str(current_user.id):
        #     raise HTTPException(status_code=403, detail="Access denied")
        
        # 使用模拟用户ID
        mock_user_id = "mock-user-id"
        
        # 创建聊天记录
        chat_id = str(uuid.uuid4())
        thread_id = chat_history.thread_id or str(uuid.uuid4())
        sequence = chat_history.sequence or 1
        
        chat_record = ChatHistory(
            id=chat_id,
            paper_id=chat_history.paper_id,
            user_id=mock_user_id,  # 使用模拟用户ID
            message=chat_history.message,
            role=chat_history.role,
            chat_type=chat_history.chat_type,
            thread_id=thread_id,
            sequence=sequence,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # 存储到内存中
        in_memory_chat_history[chat_id] = chat_record.model_dump()
        
        return chat_record
        
    except Exception as e:
        logger.error(f"Error creating chat history: {e}")
        if "Paper not found" in str(e):
            raise HTTPException(status_code=404, detail="Paper not found")
        raise HTTPException(status_code=500, detail=f"Error creating chat history: {str(e)}")


@chat_history_router.get("/paper/{paper_id}", response_model=List[ChatHistory])
async def get_paper_chat_history(
    paper_id: str,
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
):
    """获取论文的聊天历史"""
    try:
        # 检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        if paper_id not in in_memory_papers:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # 检查用户权限 - 暂时跳过，使用模拟用户ID
        # paper_data = in_memory_papers[paper_id]
        # if paper_data.get("user_id") != str(current_user.id):
        #     raise HTTPException(status_code=403, detail="Access denied")
        
        # 获取该论文的所有聊天记录
        paper_chats = [
            ChatHistory(**chat_data) for chat_data in in_memory_chat_history.values()
            if chat_data.get("paper_id") == paper_id
        ]
        
        # 按创建时间排序
        paper_chats.sort(key=lambda x: x.created_at)
        
        return paper_chats
        
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving chat history")


@chat_history_router.get("/thread/{thread_id}", response_model=List[ChatHistory])
async def get_thread_chat_history(
    thread_id: str,
    current_user: CurrentUser = Depends(get_required_user),
):
    """获取特定线程的聊天历史"""
    try:
        # 获取该线程的所有聊天记录
        thread_chats = [
            ChatHistory(**chat_data) for chat_data in in_memory_chat_history.values()
            if chat_data.get("thread_id") == thread_id
        ]
        
        if not thread_chats:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        # 检查用户权限（检查第一个聊天记录的论文权限）
        first_chat = thread_chats[0]
        from app.api.paper_upload_api import in_memory_papers
        
        if first_chat.paper_id in in_memory_papers:
            paper_data = in_memory_papers[first_chat.paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                raise HTTPException(status_code=403, detail="Access denied")
        
        # 按序列号排序
        thread_chats.sort(key=lambda x: x.sequence or 0)
        
        return thread_chats
        
    except Exception as e:
        logger.error(f"Error getting thread chat history: {e}")
        if "Thread not found" in str(e):
            raise HTTPException(status_code=404, detail="Thread not found")
        raise HTTPException(status_code=500, detail="Error retrieving thread chat history")


@chat_history_router.delete("/{chat_id}")
async def delete_chat_history(
    chat_id: str,
    current_user: CurrentUser = Depends(get_required_user),
):
    """删除聊天记录"""
    try:
        if chat_id not in in_memory_chat_history:
            raise HTTPException(status_code=404, detail="Chat history not found")
        
        chat_data = in_memory_chat_history[chat_id]
        
        # 检查用户权限
        if chat_data.get("user_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # 删除聊天记录
        del in_memory_chat_history[chat_id]
        
        return {"message": "Chat history deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting chat history: {e}")
        raise HTTPException(status_code=500, detail="Error deleting chat history") 