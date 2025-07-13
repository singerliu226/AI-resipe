.PHONY: dev-api test-api health-check clean

# 启动API开发服务器
dev-api:
	uvicorn main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8000

# 启动API生产服务器
start-api:
	uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port 8000

# 测试API健康状态
health-check:
	curl -s http://127.0.0.1:8000/api/v1/health

# 测试数据库连接
test-db:
	python scripts/test-db.py

# 清理进程
clean:
	pkill -f uvicorn || true 