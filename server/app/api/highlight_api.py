import logging
import uuid
from typing import Optional

from app.auth.dependencies import get_required_user
from app.schemas.user import CurrentUser
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create API router
highlight_router = APIRouter()


class CreateHighlightRequest(BaseModel):
    paper_id: str
    raw_text: str
    start_offset: int
    end_offset: int


class UpdateHighlightRequest(BaseModel):
    raw_text: str
    start_offset: int
    end_offset: int


# 内存存储高亮数据
in_memory_highlights = {}


@highlight_router.post("")
async def create_highlight(
    request: CreateHighlightRequest,
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Create a new highlight for a document"""
    try:
        # 检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        paper_id = str(request.paper_id)
        if paper_id not in in_memory_papers:
            return JSONResponse(
                status_code=404,
                content={"message": "Paper not found"},
            )
        
        # 检查用户权限
        paper_data = in_memory_papers[paper_id]
        if paper_data.get("user_id") != str(current_user.id):
            return JSONResponse(
                status_code=403,
                content={"message": "Access denied to this paper"},
            )
        
        # 创建高亮记录
        highlight_id = str(uuid.uuid4())
        highlight_data = {
            "id": highlight_id,
            "paper_id": request.paper_id,
            "raw_text": request.raw_text,
            "start_offset": request.start_offset,
            "end_offset": request.end_offset,
            "role": "USER",
            "created_at": "2025-08-28T10:00:00Z",
            "updated_at": "2025-08-28T10:00:00Z"
        }
        
        # 存储到内存中
        in_memory_highlights[highlight_id] = highlight_data
        
        return JSONResponse(
            status_code=201,
            content=highlight_data,
        )
        
    except Exception as e:
        logger.error(f"Error creating highlight: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to create highlight: {str(e)}"},
        )


@highlight_router.get("/{paper_id}")
async def get_document_highlights(
    paper_id: str,
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
) -> JSONResponse:
    """Get all highlights for a specific document"""
    try:
        # 检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        if paper_id not in in_memory_papers:
            return JSONResponse(
                status_code=404,
                content={"message": "Paper not found"},
            )
        
        # 检查用户权限 - 暂时跳过，使用模拟用户ID
        # if paper_data.get("user_id") != str(current_user.id):
        #     return JSONResponse(
        #         status_code=403,
        #         content={"message": "Access denied"}
        #     )
        
        # 获取该论文的所有高亮
        paper_highlights = [
            highlight for highlight in in_memory_highlights.values()
            if highlight.get("paper_id") == paper_id
        ]
        
        return JSONResponse(
            status_code=200,
            content={
                "highlights": paper_highlights,  # 包装在highlights字段中
                "paper_id": paper_id
            },
        )
        
    except Exception as e:
        logger.error(f"Error fetching highlights: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to fetch highlights: {str(e)}"},
        )


@highlight_router.delete("/{highlight_id}")
async def delete_highlight(
    highlight_id: str,
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Delete a specific highlight"""
    try:
        if highlight_id not in in_memory_highlights:
            return JSONResponse(
                status_code=404,
                content={"message": f"Highlight with ID {highlight_id} not found."},
            )
        
        highlight_data = in_memory_highlights[highlight_id]
        
        # 检查用户权限
        from app.api.paper_upload_api import in_memory_papers
        paper_id = highlight_data.get("paper_id")
        
        if paper_id and paper_id in in_memory_papers:
            paper_data = in_memory_papers[paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                return JSONResponse(
                    status_code=403,
                    content={"message": "Access denied to this highlight"},
                )
        
        # 删除高亮
        del in_memory_highlights[highlight_id]
        
        return JSONResponse(
            status_code=200,
            content={"message": "Highlight deleted successfully"},
        )
        
    except Exception as e:
        logger.error(f"Error deleting highlight: {e}")
        return JSONResponse(
            status_code=404,
            content={
                "message": f"Highlight not found or couldn't be deleted: {str(e)}"
            },
        )


@highlight_router.patch("/{highlight_id}")
async def update_highlight(
    highlight_id: str,
    request: UpdateHighlightRequest,
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Update an existing highlight"""
    try:
        if highlight_id not in in_memory_highlights:
            return JSONResponse(
                status_code=404,
                content={"message": f"Highlight with ID {highlight_id} not found."},
            )
        
        highlight_data = in_memory_highlights[highlight_id]
        
        # 检查用户权限
        from app.api.paper_upload_api import in_memory_papers
        paper_id = highlight_data.get("paper_id")
        
        if paper_id and paper_id in in_memory_papers:
            paper_data = in_memory_papers[paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                return JSONResponse(
                    status_code=403,
                    content={"message": "Access denied to this highlight"},
                )
        
        # 更新高亮数据
        highlight_data.update({
            "raw_text": request.raw_text,
            "start_offset": request.start_offset,
            "end_offset": request.end_offset,
            "updated_at": "2025-08-28T10:00:00Z"
        })
        
        in_memory_highlights[highlight_id] = highlight_data
        
        return JSONResponse(status_code=200, content=highlight_data)
        
    except Exception as e:
        logger.error(f"Error updating highlight: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to update highlight: {str(e)}"},
        )
