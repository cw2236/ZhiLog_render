#!/bin/bash

# Render启动脚本
echo "Starting ZhiLog Backend on Render..."

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /opt/render/project/src/server/jobs/uploads/papers

# 直接启动Gunicorn服务（无数据库模式）
echo "Starting Gunicorn server in no-database mode..."
exec gunicorn -c gunicorn.config.py app.main:app 