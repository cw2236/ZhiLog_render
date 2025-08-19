#!/bin/bash

# Render Celery Worker启动脚本
echo "Starting ZhiLog Celery Worker on Render..."

# 等待Redis就绪
echo "Waiting for Redis to be ready..."
sleep 10

# 启动Celery Worker
echo "Starting Celery worker..."
cd /opt/render/project/src/jobs
exec celery -A src.celery_app worker --loglevel=info 