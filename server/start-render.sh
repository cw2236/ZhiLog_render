#!/bin/bash

# Render启动脚本
echo "Starting ZhiLog Backend on Render..."

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /opt/render/project/src/server/jobs/uploads/papers

# 直接启动uvicorn服务（无数据库模式）
echo "Starting uvicorn server in no-database mode..."
cd /opt/render/project/src/server
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 