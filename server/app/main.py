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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[client_domain],
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

# 挂载 jobs/uploads 目录为 /static/pdf
pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../jobs/uploads'))
app.mount("/static/pdf", StaticFiles(directory=pdf_dir), name="pdf")

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
