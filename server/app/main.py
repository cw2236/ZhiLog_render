import logging
import os

import uvicorn  # type: ignore
from app.api.annotation_api import annotation_router
from app.api.api import router
from app.api.auth_api import auth_router
from app.api.conversation_api import conversation_router
from app.api.highlight_api import highlight_router
from app.api.message_api import message_router
from app.api.paper_api import paper_router
from app.api.paper_audio_api import paper_audio_router
from app.api.paper_image_api import paper_image_router
from app.api.paper_search_api import paper_search_router
from app.api.paper_upload_api import paper_upload_router
from app.api.search_api import search_router
from app.api.subscription_api import subscription_router
from app.api.webhook_api import webhook_router
from app.api.chat_history_api import chat_history_router
from app.database.admin import setup_admin
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

# Include the router in the main app
app.include_router(router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")  # Auth routes
app.include_router(paper_router, prefix="/api/paper")
app.include_router(conversation_router, prefix="/api/conversation")
app.include_router(message_router, prefix="/api/message")
app.include_router(highlight_router, prefix="/api/highlight")  # 修复：使用/api/highlight前缀
app.include_router(annotation_router, prefix="/api/annotation")
app.include_router(paper_search_router, prefix="/api/search/global")
app.include_router(search_router, prefix="/api/search/local")
app.include_router(paper_audio_router, prefix="/api/paper/audio")
app.include_router(paper_image_router, prefix="/api/paper/image")
app.include_router(paper_upload_router, prefix="/api/paper/upload")
app.include_router(
    subscription_router, prefix="/api/subscription"
)  # Subscription routes
app.include_router(webhook_router, prefix="/api/webhooks")  # Webhook routes
app.include_router(chat_history_router, prefix="/api/chat-history", tags=["chat-history"])

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

# 挂载 jobs/uploads 目录为 /static/pdf
pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../jobs/uploads'))
app.mount("/static/pdf", StaticFiles(directory=pdf_dir), name="pdf")

setup_admin(app)  # Setup admin interface

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
