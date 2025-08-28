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

import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Union, Dict, Any

import requests
from app.auth.dependencies import get_required_user
from app.database.crud.paper_crud import paper_crud
from app.database.crud.paper_upload_crud import (
    PaperUploadJobCreate,
    PaperUploadJobUpdate,
    paper_upload_job_crud,
)
from app.database.database import get_db
from app.database.models import PaperUploadJob
from app.database.telemetry import track_event
from app.helpers.pdf_jobs import pdf_jobs_client
from app.helpers.subscription_limits import (
    can_user_access_knowledge_base,
    can_user_upload_paper,
)
from app.schemas.user import CurrentUser
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
from app.services.storage import storage_service

load_dotenv()

logger = logging.getLogger(__name__)

# 内存存储用于无数据库模式
in_memory_jobs: Dict[str, Dict[str, Any]] = {}
in_memory_papers: Dict[str, Dict[str, Any]] = {}  # 添加论文存储

# 本地文件存储路径
LOCAL_UPLOADS_DIR = "server/jobs/uploads/papers"

# 确保本地上传目录存在
os.makedirs(LOCAL_UPLOADS_DIR, exist_ok=True)

# Create API router with prefix
paper_upload_router = APIRouter()


@paper_upload_router.get("/test")
async def test_endpoint():
    """
    Test endpoint to verify routing
    """
    return {"message": "Test endpoint working"}


@paper_upload_router.get("/download/{paper_id}")
async def get_paper_file(
    paper_id: str,
    request: Request,
):
    """
    Get the PDF file for a paper
    """
    # 从内存存储中获取论文
    if paper_id in in_memory_papers:
        paper_data = in_memory_papers[paper_id]
        
        # 检查本地文件路径
        local_file_path = paper_data.get("local_file_path")
        if local_file_path and os.path.exists(local_file_path):
            from fastapi.responses import FileResponse
            return FileResponse(
                local_file_path,
                media_type="application/pdf",
                filename=paper_data.get("filename", "paper.pdf")
            )
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="File not found")
    
    # 如果内存中没有，返回404
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Paper not found")


class UploadFromUrlSchema(BaseModel):
    url: HttpUrl


@paper_upload_router.get("/status/{job_id}")
async def get_upload_status(
    job_id: str,
    current_user: CurrentUser = Depends(get_required_user),
    db: Session = Depends(get_db),
):
    """
    Get the status of a paper upload job, including real-time Celery task status.
    """
    # 首先检查内存存储
    if job_id in in_memory_jobs:
        job = in_memory_jobs[job_id]
        if job.get("user_id") == str(current_user.id):
            # 检查是否有对应的论文记录
            paper = None
            if job.get("paper_id"):
                paper = in_memory_papers.get(job.get("paper_id"))
            
            return JSONResponse(status_code=200, content={
                "job_id": job_id,
                "status": job.get("status", "pending"),
                "task_id": job.get("task_id"),
                "started_at": job.get("started_at"),
                "completed_at": job.get("completed_at"),
                "has_file_url": bool(paper.get("file_url") if paper else False),
                "has_metadata": bool(paper.get("abstract") if paper else False),
                "paper_id": job.get("paper_id"),
                "paper": paper,  # 返回完整的论文信息
            })
    
    # 如果内存中没有，尝试数据库（向后兼容）
    try:
        paper_upload_job = paper_upload_job_crud.get(db=db, id=job_id, user=current_user)

        if not paper_upload_job:
            return JSONResponse(status_code=404, content={"message": "Job not found"})

        paper = paper_crud.get_by_upload_job_id(
            db=db, upload_job_id=str(paper_upload_job.id), user=current_user
        )

        if paper_upload_job.status == "completed":
            # Verify the paper exists
            if not paper:
                return JSONResponse(status_code=404, content={"message": "Paper not found"})

        # Get real-time Celery task status if we have a task_id
        celery_task_status = None
        if paper_upload_job.task_id:
            try:
                celery_task_status = pdf_jobs_client.check_celery_task_status(
                    str(paper_upload_job.task_id)
                )
            except Exception as e:
                logger.warning(
                    f"Failed to get Celery task status for {paper_upload_job.task_id}: {e}"
                )

        # Build response with both job status and task status
        response_content = {
            "job_id": str(paper_upload_job.id),
            "status": paper_upload_job.status,
            "task_id": paper_upload_job.task_id,
            "started_at": paper_upload_job.started_at.isoformat(),
            "completed_at": (
                paper_upload_job.completed_at.isoformat()
                if paper_upload_job.completed_at
                else None
            ),
            "has_file_url": bool(paper.file_url) if paper else False,
            "has_metadata": bool(paper.abstract) if paper else False,
            "paper_id": str(paper.id) if paper else None,
        }

        # Add Celery task information if available
        if celery_task_status:
            response_content.update(
                {
                    "celery_status": celery_task_status.get("status"),
                    "celery_progress_message": celery_task_status.get("progress_message"),
                    "celery_error": celery_task_status.get("error"),
                }
            )

        return JSONResponse(status_code=200, content=response_content)
    except Exception as e:
        logger.error(f"Error getting job status from database: {e}")
        return JSONResponse(status_code=500, content={"message": "Error retrieving job status"})


@paper_upload_router.post("/from-url/")
async def upload_pdf_from_url(
    request: UploadFromUrlSchema,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_required_user),
    db: Session = Depends(get_db),
):
    """
    Upload a document from a given URL, rather than the raw file.
    """

    # Check subscription limits before proceeding
    err_message = await check_subscription_limits(current_user, db)
    if err_message:
        return JSONResponse(
            status_code=403,
            content={
                "message": err_message,
                "error_code": "SUBSCRIPTION_LIMIT_EXCEEDED",
            },
        )

    # Validate the URL
    url = request.url
    if not url or not str(url).lower().endswith(".pdf"):
        return JSONResponse(status_code=400, content={"message": "URL must be a PDF"})

    # 创建内存中的job记录
    job_id = str(uuid.uuid4())
    in_memory_jobs[job_id] = {
        "id": job_id,
        "user_id": str(current_user.id),
        "status": "pending",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "task_id": None,
        "url": str(url)
    }

    background_tasks.add_task(
        upload_file_from_url_microservice_memory,
        url=url,
        job_id=job_id,
        current_user=current_user,
    )

    return JSONResponse(
        status_code=202,
        content={
            "message": "File upload started",
            "job_id": job_id,
        },
    )


@paper_upload_router.post("/")
async def upload_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_required_user),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF file
    """
    # Check subscription limits before proceeding
    err_message = await check_subscription_limits(current_user, db)
    if err_message:
        return JSONResponse(
            status_code=403,
            content={
                "message": err_message,
                "error_code": "SUBSCRIPTION_LIMIT_EXCEEDED",
            },
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return JSONResponse(status_code=400, content={"message": "File must be a PDF"})

    # Read the file contents BEFORE adding to background task. We need this because the UploadFile object becomes inaccessible after the request is processed.
    try:
        file_contents = await file.read()
        filename = file.filename
    except Exception as e:
        logger.error(f"Error reading uploaded file: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=400, content={"message": "Error reading uploaded file"}
        )

    # 创建内存中的job记录
    job_id = str(uuid.uuid4())
    in_memory_jobs[job_id] = {
        "id": job_id,
        "user_id": str(current_user.id),
        "status": "pending",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "task_id": None,
        "filename": filename
    }

    # Pass file contents and filename instead of the UploadFile object
    background_tasks.add_task(
        upload_raw_file_microservice_memory,
        file_contents=file_contents,
        filename=filename,
        job_id=job_id,
        current_user=current_user,
    )

    return JSONResponse(
        status_code=202,
        content={
            "message": "File upload started",
            "job_id": job_id,
        },
    )


async def upload_file_from_url_microservice_memory(
    url: HttpUrl,
    job_id: str,
    current_user: CurrentUser,
) -> None:
    """
    Helper function to upload a file from a URL using the microservice.
    """
    job = in_memory_jobs[job_id]

    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()

    try:
        # Download the file to get its contents
        response = requests.get(str(url), timeout=30)
        response.raise_for_status()
        file_contents = response.content

        # Submit to microservice
        task_id = pdf_jobs_client.submit_pdf_processing_job(
            pdf_bytes=file_contents, job_id=str(job["id"])
        )

        # Update job with task_id
        job["task_id"] = task_id
        
        # 创建论文记录
        paper_id = str(uuid.uuid4())
        filename = str(url).split("/")[-1] or "downloaded.pdf"
        paper = {
            "id": paper_id,
            "title": filename.replace(".pdf", ""),
            "filename": filename,
            "file_url": str(url),  # 使用原始URL
            "abstract": f"Abstract for {filename}",  # 模拟摘要
            "authors": ["Unknown Author"],  # 模拟作者
            "year": datetime.now().year,
            "doi": None,
            "arxiv_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "user_id": str(current_user.id),
            "upload_job_id": job_id,
            "preview_image_url": f"/previews/{paper_id}.png",  # 模拟预览图片
            "file_size_kb": len(file_contents) // 1024,
        }
        
        # 存储论文记录
        in_memory_papers[paper_id] = paper
        
        # 更新job记录，关联论文ID
        job["paper_id"] = paper_id
        job["status"] = "completed"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        logger.error(
            f"Error submitting file from URL to microservice: {str(e)}", exc_info=True
        )
        job["status"] = "failed"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()


async def upload_raw_file_microservice_memory(
    file_contents: bytes,
    filename: str,
    job_id: str,
    current_user: CurrentUser,
) -> None:
    """
    Helper function to upload a raw file using the microservice.
    """
    job = in_memory_jobs[job_id]

    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()

    try:
        # 保存文件到本地
        paper_id = job_id  # 使用job_id作为paper_id
        local_filename = f"{paper_id}_{filename}"
        local_file_path = os.path.join(LOCAL_UPLOADS_DIR, local_filename)
        
        with open(local_file_path, "wb") as f:
            f.write(file_contents)
        
        # Submit to microservice
        task_id = pdf_jobs_client.submit_pdf_processing_job(
            pdf_bytes=file_contents,
            job_id=str(job["id"])
        )

        # 创建论文记录
        paper_id = str(uuid.uuid4())
        paper = {
            "id": paper_id,
            "title": filename.replace(".pdf", ""),
            "filename": filename,
            "file_url": f"/api/paper/{paper_id}/file",  # 使用本地文件服务端点
            "local_file_path": local_file_path,  # 保存本地文件路径
            "abstract": f"Abstract for {filename}",  # 模拟摘要
            "authors": ["Unknown Author"],  # 模拟作者
            "year": datetime.now().year,
            "doi": None,
            "arxiv_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "user_id": str(current_user.id),
            "upload_job_id": job_id,
            "preview_image_url": f"/previews/{paper_id}.png",  # 模拟预览图片
            "file_size_kb": len(file_contents) // 1024,
        }
        
        # 存储论文记录
        in_memory_papers[paper_id] = paper
        
        # 更新job记录，关联论文ID
        job["paper_id"] = paper_id
        job["status"] = "completed"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()

        # Track the upload event
        track_event(
            event_name="paper_upload",
            properties={
                "upload_type": "file",
                "job_id": str(job["id"]),
                "paper_id": paper_id,
            },
            user_id=str(current_user.id)
        )

    except Exception as e:
        logger.error(f"Error submitting file to microservice: {str(e)}", exc_info=True)
        job["status"] = "failed"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()


async def check_subscription_limits(
    current_user: CurrentUser,
    db: Session,
) -> Union[str, None]:
    """
    Check if the user can upload a new paper based on their subscription limits.
    Returns a JSONResponse with an error message if limits are exceeded.
    """
    can_upload, error_message = can_user_upload_paper(db, current_user)
    if not can_upload and error_message:
        return error_message

    can_access, error_message = can_user_access_knowledge_base(db, current_user)
    if not can_access and error_message:
        return error_message

    return None
