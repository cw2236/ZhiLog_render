import logging
import os

import uvicorn  # type: ignore
from app.api.auth_api import auth_router
from app.api.highlight_api import highlight_router
from app.api.paper_api import paper_router
from app.api.paper_upload_api import paper_upload_router
from app.api.chat_history_api import chat_history_router
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.requests import Request

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="Open Paper",
    description="A web application for uploading and annotating papers.",
    version="1.0.0",
)

client_domain = os.getenv("CLIENT_DOMAIN", "http://localhost:3000")

# Configure CORS - 允许前端域名和本地开发
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        client_domain,
        "https://zhilog-frontend.onrender.com",  # 前端生产域名
        "http://localhost:3000",  # 本地开发
        "https://localhost:3000"  # 本地开发HTTPS
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    allow_credentials=True,
    max_age=3600,
)

# Include only the routers needed for no-database mode
app.include_router(auth_router, prefix="/api/auth")  # Auth routes
app.include_router(paper_router, prefix="/api/paper")  # Paper routes
app.include_router(highlight_router, prefix="/api/highlight")  # Highlight routes
app.include_router(paper_upload_router, prefix="/api/paper/upload")  # Paper upload routes
app.include_router(chat_history_router, prefix="/api/chat-history", tags=["chat-history"])  # Chat history routes

# 添加文件下载端点
@app.get("/api/paper/{paper_id}/file")
async def get_paper_file(
    paper_id: str,
    request: Request,
):
    """
    Get the PDF file for a paper
    """
    # 首先尝试从内存存储中获取论文
    from app.api.paper_upload_api import in_memory_papers
    
    if paper_id in in_memory_papers:
        paper_data = in_memory_papers[paper_id]
        
        # 检查本地文件路径
        local_file_path = paper_data.get("local_file_path")
        if local_file_path and os.path.exists(local_file_path):
            return FileResponse(
                local_file_path,
                media_type="application/pdf",
                filename=paper_data.get("filename", "paper.pdf")
            )
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    # 如果内存中没有，返回404
    raise HTTPException(status_code=404, detail="Paper not found")

# 健康检查端点
@app.get("/api/health")
async def health_check():
    """Health check endpoint for Render"""
    return {"status": "healthy", "message": "ZhiLog Backend is running in no-database mode"}

# 添加缺失的API端点以避免404错误
@app.get("/api/auth/onboarding")
async def get_onboarding():
    """Get onboarding data - 返回模拟数据"""
    return {
        "completed": True,
        "steps": ["upload", "view", "chat", "highlight"],
        "current_step": "complete"
    }

@app.get("/api/paper/note")
async def get_paper_note(paper_id: str):
    """Get paper note - 返回模拟数据"""
    return {
        "paper_id": paper_id,
        "content": "",
        "created_at": "2025-08-31T14:30:00Z",
        "updated_at": "2025-08-31T14:30:00Z"
    }

@app.get("/api/message/models")
async def get_available_models():
    """Get available LLM models - 返回模拟数据"""
    return {
        "models": [
            {"id": "gpt-4", "name": "GPT-4", "available": True},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "available": True}
        ]
    }

# 添加更多缺失的API端点
@app.get("/api/annotation/{paper_id}")
async def get_paper_annotations(paper_id: str):
    """Get paper annotations - 返回模拟数据"""
    return {
        "paper_id": paper_id,
        "annotations": [],
        "highlights": []
    }

@app.get("/api/paper/conversation")
async def get_paper_conversation(paper_id: str):
    """Get paper conversation - 返回模拟数据"""
    return {
        "paper_id": paper_id,
        "conversation_id": f"conv_{paper_id}",
        "messages": []
    }

@app.post("/api/conversation/{paper_id}")
async def create_paper_conversation(paper_id: str):
    """Create paper conversation - 返回模拟数据"""
    return {
        "paper_id": paper_id,
        "conversation_id": f"conv_{paper_id}",
        "created_at": "2025-08-31T14:30:00Z"
    }

@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation - 返回模拟数据"""
    return {
        "conversation_id": conversation_id,
        "paper_id": conversation_id.replace("conv_", ""),
        "messages": [],
        "created_at": "2025-08-31T14:30:00Z"
    }

# 创建必要的目录
def create_upload_directories():
    """创建上传目录"""
    try:
        # 尝试多个可能的路径
        possible_paths = [
            "server/jobs/uploads/papers",
            "jobs/uploads/papers", 
            "/opt/render/project/src/server/jobs/uploads/papers",
            "/opt/render/project/src/jobs/uploads/papers",
            "uploads/papers"
        ]
        
        for path in possible_paths:
            try:
                os.makedirs(path, exist_ok=True)
                logger.info(f"Created/verified directory: {path}")
                return path
            except Exception as e:
                logger.warning(f"Could not create directory {path}: {e}")
                continue
        
        # 如果所有路径都失败，使用当前目录
        fallback_path = "uploads/papers"
        os.makedirs(fallback_path, exist_ok=True)
        logger.info(f"Using fallback directory: {fallback_path}")
        return fallback_path
        
    except Exception as e:
        logger.error(f"Error creating upload directories: {e}")
        # 使用当前目录作为最后的备选
        fallback_path = "uploads/papers"
        os.makedirs(fallback_path, exist_ok=True)
        return fallback_path

# 创建上传目录
upload_dir = create_upload_directories()

# 挂载上传目录为静态文件服务
try:
    app.mount("/static/pdf", StaticFiles(directory=upload_dir), name="pdf")
    logger.info(f"Successfully mounted /static/pdf to {upload_dir}")
except Exception as e:
    logger.error(f"Failed to mount static files: {e}")
    # 如果挂载失败，我们仍然可以继续运行，只是静态文件服务不可用

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    log_config = uvicorn.config.LOGGING_CONFIG  # type: ignore
    log_config["formatters"]["access"][
        "fmt"
    ] = "%(asctime)s - %(levelname)s - %(message)s"
    log_config["formatters"]["default"][
        "fmt"
    ] = "%(asctime)s - %(levelname)s - %(message)s"
    # Set higher log level to see more details
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        # reload=True,
        log_level="debug",
        log_config=log_config,
        forwarded_allow_ips="*",  # Allow all forwarded IPs
        proxy_headers=True,  # Enable proxy headers
    )
