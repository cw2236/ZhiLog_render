import json
import logging
from typing import List, Optional

from app.auth.dependencies import get_current_user, get_required_user
from app.llm.client import get_llm_client
from app.llm.schemas import ResponseCitation
from app.schemas.user import CurrentUser
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

# Create API router with prefix
paper_router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    context_type: str = "full_text"


@paper_router.get("/all")
async def get_paper_ids(
    current_user: CurrentUser = Depends(get_required_user),
):
    """
    Get all paper IDs from memory storage
    """
    try:
        from app.api.paper_upload_api import in_memory_papers
        
        # 获取当前用户的论文
        user_papers = [
            paper for paper in in_memory_papers.values() 
            if paper.get("user_id") == str(current_user.id)
        ]
        
        if not user_papers:
            return JSONResponse(status_code=404, content={"message": "No papers found"})
        
        return JSONResponse(
            status_code=200,
            content={
                "papers": [
                    {
                        "id": paper["id"],
                        "title": paper.get("title", "Untitled"),
                        "created_at": paper.get("created_at", ""),
                        "abstract": paper.get("abstract", ""),
                        "authors": paper.get("authors", []),
                        "filename": paper.get("filename", ""),
                        "file_size_kb": paper.get("file_size_kb", 0),
                    }
                    for paper in user_papers
                ]
            },
        )
    except Exception as e:
        logger.error(f"Error getting papers: {e}")
        return JSONResponse(status_code=500, content={"message": "Internal server error"})


@paper_router.get("")
async def get_pdf(
    id: str,
    current_user: CurrentUser = Depends(get_required_user),
):
    """
    Get paper details from memory storage
    """
    try:
        from app.api.paper_upload_api import in_memory_papers
        
        if id not in in_memory_papers:
            return JSONResponse(status_code=404, content={"message": "Paper not found"})
        
        paper_data = in_memory_papers[id]
        
        # 检查用户权限
        if paper_data.get("user_id") != str(current_user.id):
            return JSONResponse(status_code=403, content={"message": "Access denied"})
        
        # 构建响应数据
        response_data = {
            "id": paper_data["id"],
            "title": paper_data.get("title", "Untitled"),
            "abstract": paper_data.get("abstract", ""),
            "authors": paper_data.get("authors", []),
            "year": paper_data.get("year", 2025),
            "filename": paper_data.get("filename", ""),
            "file_url": paper_data.get("file_url", ""),
            "created_at": paper_data.get("created_at", ""),
            "updated_at": paper_data.get("updated_at", ""),
            "size_in_kb": paper_data.get("file_size_kb", 0),
        }
        
        return JSONResponse(status_code=200, content=response_data)
        
    except Exception as e:
        logger.error(f"Error getting paper: {e}")
        return JSONResponse(status_code=500, content={"message": "Internal server error"})


@paper_router.post("/{paper_id}/chat")
async def chat_with_paper(
    paper_id: str,
    request: ChatRequest,
    current_user: CurrentUser = Depends(get_required_user),
):
    """
    Chat with a paper using LLM
    """
    try:
        from app.api.paper_upload_api import in_memory_papers
        
        if paper_id not in in_memory_papers:
            return JSONResponse(status_code=404, content={"message": "Paper not found"})
        
        paper_data = in_memory_papers[paper_id]
        
        # 检查用户权限
        if paper_data.get("user_id") != str(current_user.id):
            return JSONResponse(status_code=403, content={"message": "Access denied"})
        
        # 获取论文内容作为上下文
        context = paper_data.get("raw_content", paper_data.get("abstract", ""))
        
        if not context:
            return JSONResponse(status_code=400, content={"message": "No content available for chat"})
        
        # 调用LLM进行聊天
        try:
            llm_client = get_llm_client()
            response = await llm_client.chat_with_paper(
                message=request.message,
                context=context,
                context_type=request.context_type
            )
            
            return JSONResponse(
                status_code=200,
                content={
                    "message": response.message,
                    "citations": response.citations or [],
                    "paper_id": paper_id
                }
            )
            
        except Exception as llm_error:
            logger.error(f"LLM error: {llm_error}")
            return JSONResponse(
                status_code=500,
                content={"message": f"LLM service error: {str(llm_error)}"}
            )
            
    except Exception as e:
        logger.error(f"Error in chat with paper: {e}")
        return JSONResponse(status_code=500, content={"message": "Internal server error"})


@paper_router.get("/{paper_id}/share")
async def get_shareable_paper(
    paper_id: str,
    current_user: CurrentUser = Depends(get_required_user),
):
    """
    Get shareable paper data
    """
    try:
        from app.api.paper_upload_api import in_memory_papers
        
        if paper_id not in in_memory_papers:
            return JSONResponse(status_code=404, content={"message": "Paper not found"})
        
        paper_data = in_memory_papers[paper_id]
        
        # 检查用户权限
        if paper_data.get("user_id") != str(current_user.id):
            return JSONResponse(status_code=403, content={"message": "Access denied"})
        
        # 构建可分享的数据
        shareable_data = {
            "paper_data": {
                "id": paper_data["id"],
                "title": paper_data.get("title", "Untitled"),
                "abstract": paper_data.get("abstract", ""),
                "authors": paper_data.get("authors", []),
                "year": paper_data.get("year", 2025),
            },
            "highlight_data": {},  # 暂时为空
            "annotations_data": {},  # 暂时为空
        }
        
        return JSONResponse(status_code=200, content=shareable_data)
        
    except Exception as e:
        logger.error(f"Error getting shareable paper: {e}")
        return JSONResponse(status_code=500, content={"message": "Internal server error"})
