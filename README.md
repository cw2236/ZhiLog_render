# ZhiLog - AI-Powered Academic Paper Reading Assistant

ZhiLog is an intelligent academic paper reading assistant that helps you better understand and interact with research papers. It features AI-powered chat, smart annotations, and collaborative features.

## Features

- 📑 PDF Viewer with smart annotations
- 🤖 AI-powered chat for both full paper and specific sections
- 💬 In-context commenting system
- 🔍 Smart search and navigation
- 📝 Note-taking with Markdown support
- 🎯 Paper progress tracking
- 🔊 Audio summaries
- 🖼️ Figure extraction and analysis
- 🤝 Collaborative sharing features

## Prerequisites

Before you begin, ensure you have the following installed:
- Python 3.9+
- Node.js 18+
- Redis 6+
- PostgreSQL 13+

## Project Structure

```
openpaper/
├── client/         # Next.js frontend
├── server/         # FastAPI backend
└── jobs/          # Celery worker for async tasks
```

## Installation

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/openpaper.git
cd openpaper

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install backend dependencies
cd server
pip install -r requirements.txt
```

Backend dependencies include:
- **Web Framework**: FastAPI, Uvicorn, Gunicorn
- **Database**: SQLAlchemy, Alembic, PostgreSQL
- **Authentication**: python-jose, passlib
- **File Processing**: PyMuPDF, Pillow
- **AI Integration**: OpenAI, Google Generative AI
- **Task Queue**: Celery, Redis
- **Cloud Services**: Boto3 (AWS)
- **Monitoring**: PostHog
- **Payment**: Stripe

### 2. Frontend Setup

```bash
# Install frontend dependencies
cd client
npm install
```

Frontend dependencies include:
- **Framework**: Next.js, React
- **UI Components**: Radix UI, shadcn/ui
- **PDF Handling**: react-pdf
- **Styling**: TailwindCSS
- **Markdown**: react-markdown, remark-gfm
- **Icons**: Lucide React
- **Notifications**: Sonner

### 3. Redis Setup

Make sure Redis is running on your system:
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download and install from https://redis.io/download
```

### 4. Celery Worker Setup

```bash
cd jobs
pip install -r requirements.txt
```

Celery worker dependencies include:
- **Task Queue**: Celery with Redis/RabbitMQ support
- **Monitoring**: Flower
- **PDF Processing**: PyMuPDF, PyMuPDF4LLM
- **System Monitoring**: psutil

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
OPENAI_API_KEY=your_openai_api_key
REDIS_URL=redis://localhost:6379/0
GOOGLE_AI_API_KEY=your_google_ai_key  # Optional
AWS_ACCESS_KEY_ID=your_aws_key        # Optional
AWS_SECRET_ACCESS_KEY=your_aws_secret # Optional
STRIPE_SECRET_KEY=your_stripe_key     # Optional
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key  # Optional
```

## Starting the Application

有两种启动方式：

### 方式一：前台运行（开发模式）

1. **Start Redis** (if not already running):
```bash
redis-server
```

2. **Start the Backend Server**:
```bash
cd server
uvicorn app.main:app --reload --port 8000
```

3. **Start Celery Worker**:
```bash
cd jobs
celery -A src.celery_app worker --loglevel=info
```

4. **Start the Frontend Development Server**:
```bash
cd client
npm run dev
```

### 方式二：后台运行（推荐）

1. **首先确保 Redis 在运行**:
```bash
# 检查 Redis 状态
redis-cli ping  # 应该返回 PONG

# 如果没有运行，启动 Redis
redis-server
```

2. **关闭所有已存在的服务**:
```bash
# 关闭所有运行中的 uvicorn、celery 和 node 进程
pkill -f "uvicorn|celery|node"
```

3. **启动所有服务**:
```bash
# 启动后端服务
cd server && nohup uvicorn app.main:app --reload --port 8000 > server.log 2>&1 &

# 启动 Celery worker
cd ../jobs && nohup celery -A src.celery_app worker --loglevel=info > celery.log 2>&1 &

# 启动前端服务
cd ../client && nohup npm run dev > frontend.log 2>&1 &
```

4. **检查服务状态**:
```bash
# 检查所有服务是否正在运行
ps aux | grep -E "uvicorn|celery|node" | grep -v grep
```

5. **查看日志**:
```bash
# 查看后端日志
tail -f server/server.log

# 查看 Celery 日志
tail -f jobs/celery.log

# 查看前端日志
tail -f client/frontend.log
```

服务启动后可以访问：
- 前端界面：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs
- Celery API：http://localhost:8001

### 常见启动问题

1. **端口被占用**:
```bash
# 查看占用端口 8000 的进程
lsof -i :8000
# 杀死占用端口的进程
kill -9 <PID>
```

2. **服务无响应**:
```bash
# 重启所有服务
pkill -f "uvicorn|celery|node"
# 然后按照上述步骤重新启动
```

3. **Redis 连接问题**:
```bash
# 检查 Redis 连接
redis-cli ping
# 如果无响应，重启 Redis
brew services restart redis  # macOS
sudo service redis restart  # Linux
```

4. **日志检查**:
```bash
# 实时查看所有日志
tail -f server/server.log jobs/celery.log client/frontend.log
```

### 开发模式提示

- 使用 `--reload` 参数启动后端可以实现代码热重载
- 前端默认启用热重载
- Celery worker 需要手动重启才能加载代码更改
- 建议在开发时打开多个终端窗口分别运行各服务，方便查看日志

## Common Issues & Solutions

1. **Port Conflicts**
   - If port 8000 is in use: `lsof -i :8000` to find the process, then kill it
   - If port 3000 is in use: Next.js will automatically suggest the next available port

2. **Redis Connection Issues**
   - Ensure Redis is running: `redis-cli ping` should return `PONG`
   - Check Redis connection string in .env files
   - Make sure Redis is not password protected or update connection string accordingly

3. **Celery Worker Issues**
   - Ensure Redis is running
   - Check Celery broker URL in .env
   - Make sure ports 8000 and 8001 are available
   - If using RabbitMQ instead of Redis, update broker URL accordingly

4. **PDF Processing Issues**
   - Ensure PyMuPDF and PyMuPDF4LLM are properly installed
   - Check if the PDF file is not corrupted
   - Verify file permissions in the upload directory

5. **Database Issues**
   - Run migrations: `alembic upgrade head`
   - Check PostgreSQL service is running
   - Verify database connection string

## Development Tips

1. **Backend Development**
   - Use `uvicorn app.main:app --reload --port 8000` for auto-reload
   - Access API docs at `/docs` or `/redoc`
   - Use `alembic revision --autogenerate` for DB migrations

2. **Frontend Development**
   - Use `npm run dev` for hot-reload
   - Check browser console for errors
   - Use React DevTools for component debugging

3. **Worker Development**
   - Use `celery -A src.celery_app worker --loglevel=debug` for detailed logs
   - Monitor tasks with Flower: `celery -A src.celery_app flower`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.



pkill -f "uvicorn|celery|node"
redis-cli ping
cd server && nohup uvicorn app.main:app --reload --port 8000 > server.log 2>&1 &
cd jobs && nohup celery -A src.celery_app worker --loglevel=info > celery.log 2>&1 &
cd client && nohup npm run dev > frontend.log 2>&1 &
ps aux | grep -E "uvicorn|celery|node" | grep -v grep
