#!/bin/bash

# Render Celery API启动脚本
echo "Starting ZhiLog Celery API on Render..."

# 等待Redis就绪
echo "Waiting for Redis to be ready..."
sleep 10

# 启动Celery API服务
echo "Starting Celery API server..."
cd /opt/render/project/src/jobs
exec python -m uvicorn src.app:app --host 0.0.0.0 --port 8001 