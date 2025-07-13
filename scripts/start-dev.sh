#!/bin/bash
# 开发环境启动脚本

echo "🚀 启动智能食谱开发环境..."

# 检查Docker PostgreSQL是否运行
if ! docker ps | grep -q smart-recipe-postgres; then
    echo "❌ PostgreSQL容器未运行，请先启动数据库"
    echo "运行: docker start smart-recipe-postgres"
    exit 1
fi

echo "✅ PostgreSQL容器正在运行"

# 测试数据库连接
echo "🔍 测试数据库连接..."
python scripts/test-db.py
if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    exit 1
fi

# 清理旧进程
echo "🧹 清理旧进程..."
pkill -f uvicorn || true

# 启动API服务器
echo "🌟 启动API服务器..."
uvicorn main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8000

echo "✨ 开发环境启动完成！"
echo "API地址: http://localhost:8000"
echo "健康检查: http://localhost:8000/api/v1/health" 