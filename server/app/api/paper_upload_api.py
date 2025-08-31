"""
Paper Upload API - Microservice Integration

This module handles PDF upload and processing by integrating with a separate
PDF processing microservice. The architecture is:

1. Client uploads PDF to this API
2. API creates a PaperUploadJob record with status 'pending'
3. API submits the PDF to the separate jobs service via Celery/HTTP
4. Jobs service processes PDF (S3 upload, metadata extraction, preview generation)
5. Jobs service sends results back via webhook
6. Webhook handler updates PaperUploadJob status and creates Paper record

The client can poll the job status using the same job_id throughout the process.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from app.auth.dependencies import get_required_user
from app.llm.client import get_llm_client
from app.schemas.user import CurrentUser
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

# Create API router with prefix
paper_upload_router = APIRouter()

# 内存存储
in_memory_jobs: Dict[str, Dict[str, Any]] = {}
in_memory_papers: Dict[str, Dict[str, Any]] = {}

# 本地文件存储目录
LOCAL_UPLOADS_DIR = "server/jobs/uploads/papers"
os.makedirs(LOCAL_UPLOADS_DIR, exist_ok=True)


class UploadResponse(BaseModel):
    message: str
    job_id: str


@paper_upload_router.post("/", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
) -> JSONResponse:
    """Upload a PDF file"""
    try:
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            return JSONResponse(
                status_code=400,
                content={"message": "Only PDF files are allowed"}
            )
        
        # 创建模拟用户ID用于测试
        mock_user_id = "mock-user-id"
        
        # 创建上传任务
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "status": "started",
            "started_at": datetime.now().isoformat(),
            "user_id": mock_user_id,  # 使用模拟用户ID
            "filename": file.filename,
            "file_size": 0
        }
        
        in_memory_jobs[job_id] = job_data
        
        # 模拟文件处理
        try:
            # 保存文件到本地
            file_content = await file.read()
            file_size = len(file_content)
            
            # 创建唯一的文件名
            unique_filename = f"{job_id}_{file.filename}"
            file_path = os.path.join(LOCAL_UPLOADS_DIR, unique_filename)
            
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # 更新任务状态
            job_data.update({
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "file_size": file_size
            })
            
            # 创建论文记录
            paper_id = str(uuid.uuid4())
            paper_data = {
                "id": paper_id,
                "title": file.filename.replace('.pdf', ''),
                "filename": file.filename,
                "file_url": f"/api/paper/upload/download/{paper_id}",
                "local_file_path": file_path,
                "abstract": f"Abstract for {file.filename}",
                "authors": ["Unknown Author"],
                "year": 2025,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "user_id": mock_user_id, # 使用模拟用户ID
                "upload_job_id": job_id,
                "file_size_kb": file_size // 1024
            }
            
            in_memory_papers[paper_id] = paper_data
            
            # 更新任务记录
            job_data["paper_id"] = paper_id
            job_data["has_file_url"] = True
            job_data["has_metadata"] = True
            
        except Exception as e:
            logger.error(f"Error processing file: {e}")
            job_data.update({
                "status": "failed",
                "error": str(e)
            })
        
        return JSONResponse(
            status_code=202,
            content={"message": "File upload started", "job_id": job_id}
        )
        
    except Exception as e:
        logger.error(f"Error in upload_pdf: {e}")
        return JSONResponse(
            status_code=500,
            content={"message": f"Failed to upload file: {str(e)}"}
        )


@paper_upload_router.get("/status/{job_id}")
async def get_upload_status(
    job_id: str,
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
) -> JSONResponse:
    """Get the status of an upload job"""
    try:
        if job_id not in in_memory_jobs:
            return JSONResponse(
                status_code=404,
                content={"message": "Job not found"}
            )
        
        job_data = in_memory_jobs[job_id]
        
        # 检查用户权限 - 暂时注释掉，因为我们在测试模式下
        # if job_data.get("user_id") != str(current_user.id):
        #     return JSONResponse(
        #         status_code=403,
        #         content={"message": "Access denied"}
        #     )
        
        # 构建响应
        response_data = {
            "job_id": job_data["job_id"],
            "status": job_data["status"],
            "started_at": job_data["started_at"],
            "user_id": job_data["user_id"],
            "filename": job_data["filename"],
            "file_size": job_data["file_size"],
            "has_file_url": job_data.get("has_file_url", False),
            "has_metadata": job_data.get("has_metadata", False),
            "paper_id": job_data.get("paper_id"),
        }
        
        if "completed_at" in job_data:
            response_data["completed_at"] = job_data["completed_at"]
        
        if "paper_id" in job_data and job_data["paper_id"] in in_memory_papers:
            response_data["paper"] = in_memory_papers[job_data["paper_id"]]
        
        return JSONResponse(status_code=200, content=response_data)
        
    except Exception as e:
        logger.error(f"Error getting upload status: {e}")
        return JSONResponse(
            status_code=500,
            content={"message": f"Failed to get upload status: {str(e)}"}
        )


@paper_upload_router.get("/download/{paper_id}")
async def download_paper_file(
    paper_id: str,
    # current_user: CurrentUser = Depends(get_required_user),  # 暂时注释掉认证依赖
) -> FileResponse:
    """Download a paper file"""
    try:
        if paper_id not in in_memory_papers:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        paper_data = in_memory_papers[paper_id]
        
        # 检查用户权限 - 暂时注释掉，因为我们在测试模式下
        # if paper_data.get("user_id") != str(current_user.id):
        #     raise HTTPException(status_code=403, detail="Access denied")
        
        # 检查文件是否存在
        local_file_path = paper_data.get("local_file_path")
        if not local_file_path or not os.path.exists(local_file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            local_file_path,
            media_type="application/pdf",
            filename=paper_data.get("filename", "paper.pdf")
        )
        
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail="Error downloading file")
