import logging
import uuid

from app.auth.dependencies import get_required_user
from app.database.crud.highlight_crud import (
    HighlightCreate,
    HighlightUpdate,
    highlight_crud,
)
from app.database.database import get_db
from app.database.models import RoleType
from app.database.telemetry import track_event
from app.schemas.user import CurrentUser
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

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


@highlight_router.post("")
async def create_highlight(
    request: CreateHighlightRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Create a new highlight for a document"""
    try:
        # 首先检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        paper_id = str(request.paper_id)
        if paper_id in in_memory_papers:
            # 检查用户权限
            paper_data = in_memory_papers[paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                return JSONResponse(
                    status_code=403,
                    content={"message": "Access denied to this paper"},
                )
            
            # 对于内存存储的论文，我们暂时不保存高亮到数据库
            # 而是返回一个模拟的响应
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
            
            track_event("highlight_created", user_id=str(current_user.id))
            
            return JSONResponse(
                status_code=201,
                content=highlight_data,
            )
        
        # 如果内存中没有，尝试数据库（向后兼容）
        # 但是这里需要确保论文确实存在于数据库中
        try:
            highlight = highlight_crud.create(
                db,
                obj_in=HighlightCreate(
                    paper_id=uuid.UUID(request.paper_id),
                    raw_text=request.raw_text,
                    start_offset=request.start_offset,
                    end_offset=request.end_offset,
                    role=RoleType.USER,
                ),
                user=current_user,
            )

            if not highlight:
                raise ValueError("Failed to create highlight, please check the input data.")

            track_event("highlight_created", user_id=str(current_user.id))

            return JSONResponse(
                status_code=201,
                content=highlight.to_dict(),
            )
        except Exception as db_error:
            logger.error(f"Database error: {db_error}")
            return JSONResponse(
                status_code=404,
                content={"message": "Paper not found in database"},
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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Get all highlights for a specific document"""
    try:
        # 首先检查论文是否存在于内存存储中
        from app.api.paper_upload_api import in_memory_papers
        
        if paper_id in in_memory_papers:
            # 检查用户权限
            paper_data = in_memory_papers[paper_id]
            if paper_data.get("user_id") != str(current_user.id):
                return JSONResponse(
                    status_code=403,
                    content={"message": "Access denied to this paper"},
                )
            
            # 对于内存存储的论文，我们暂时返回空的高亮列表
            # 因为高亮还没有持久化存储
            return JSONResponse(
                status_code=200,
                content=[],
            )
        
        # 如果内存中没有，尝试数据库（向后兼容）
        try:
            highlights = highlight_crud.get_highlights_by_paper_id(
                db, paper_id=paper_id, user=current_user
            )
            return JSONResponse(
                status_code=200,
                content=[highlight.to_dict() for highlight in highlights],
            )
        except Exception as db_error:
            logger.error(f"Database error: {db_error}")
            return JSONResponse(
                status_code=404,
                content={"message": "Paper not found in database"},
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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Delete a specific highlight"""
    try:
        # First verify the highlight exists and belongs to the user
        existing_highlight = highlight_crud.get(db, id=highlight_id, user=current_user)
        if not existing_highlight:
            return JSONResponse(
                status_code=404,
                content={"message": f"Highlight with ID {highlight_id} not found."},
            )

        if existing_highlight.role == RoleType.ASSISTANT:
            return JSONResponse(
                status_code=403,
                content={"message": "Cannot delete assistant highlights."},
            )

        highlight_crud.remove(db, id=highlight_id)
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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_required_user),
) -> JSONResponse:
    """Update an existing highlight"""
    try:
        existing_highlight = highlight_crud.get(db, id=highlight_id, user=current_user)
        if not existing_highlight:
            raise ValueError(f"Highlight with ID {highlight_id} not found.")

        if existing_highlight.role == RoleType.ASSISTANT:
            return JSONResponse(
                status_code=403,
                content={"message": "Cannot update assistant highlights."},
            )

        highlight = highlight_crud.update(
            db,
            db_obj=existing_highlight,
            obj_in=HighlightUpdate(
                paper_id=existing_highlight.paper_id.uuid,
                raw_text=request.raw_text,
                start_offset=request.start_offset,
                end_offset=request.end_offset,
            ),
        )

        if not highlight:
            raise ValueError("Failed to update highlight, please check the input data.")

        track_event("highlight_updated", user_id=str(current_user.id))

        return JSONResponse(status_code=200, content=highlight.to_dict())
    except ValueError as e:

        logger.error(f"Highlight not found or invalid data: {e}")
        return JSONResponse(status_code=404, content={"message": str(e)})
    except Exception as e:
        logger.error(f"Error updating highlight: {e}")
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to update highlight: {str(e)}"},
        )
