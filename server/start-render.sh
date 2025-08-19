#!/bin/bash

# Render启动脚本
echo "Starting ZhiLog Backend on Render..."

# 等待数据库就绪
echo "Waiting for database to be ready..."
sleep 10

# 运行数据库迁移
echo "Running database migrations..."
cd /opt/render/project/src/server
alembic upgrade head

# 启动Gunicorn服务
echo "Starting Gunicorn server..."
exec gunicorn -c gunicorn.config.py app.main:app 