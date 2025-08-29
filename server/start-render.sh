#!/bin/bash

echo "Starting ZhiLog Backend on Render..."

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /opt/render/project/src/server/jobs/uploads/papers
mkdir -p /opt/render/project/src/jobs/uploads/papers
mkdir -p uploads/papers

# 设置权限
chmod -R 755 /opt/render/project/src/server/jobs/uploads
chmod -R 755 /opt/render/project/src/jobs/uploads
chmod -R 755 uploads

echo "Directories created successfully:"
ls -la /opt/render/project/src/server/jobs/uploads/papers 2>/dev/null || echo "server/jobs/uploads/papers not accessible"
ls -la /opt/render/project/src/jobs/uploads/papers 2>/dev/null || echo "jobs/uploads/papers not accessible"
ls -la uploads/papers 2>/dev/null || echo "uploads/papers not accessible"

# 直接启动uvicorn服务（无数据库模式）
echo "Starting uvicorn server in no-database mode..."
cd /opt/render/project/src/server
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 