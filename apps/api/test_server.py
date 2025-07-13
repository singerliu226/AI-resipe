#!/usr/bin/env python3
"""
测试服务器启动脚本
"""
import os
import sys
import asyncio
from pathlib import Path
from sqlalchemy import text

print("=== 开始调试服务器启动问题 ===")

# 1. 检查环境变量
print("\n1. 检查环境变量:")
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "env.local"), override=False)
load_dotenv(override=False)

database_url = os.getenv("DATABASE_URL")
print(f"DATABASE_URL: {database_url}")

if not database_url:
    print("❌ DATABASE_URL 未设置")
    sys.exit(1)
else:
    print("✅ DATABASE_URL 已设置")

# 2. 测试数据库连接
print("\n2. 测试数据库连接:")
try:
    from database import engine
    print("✅ 数据库引擎创建成功")
    
    async def test_db():
        try:
            async with engine.begin() as conn:
                result = await conn.execute(text("SELECT 1"))
                print(f"✅ 数据库连接测试成功: {result.scalar()}")
                return True
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            return False
    
    # 运行异步测试
    db_ok = asyncio.run(test_db())
    if not db_ok:
        sys.exit(1)
        
except Exception as e:
    print(f"❌ 数据库模块导入失败: {e}")
    sys.exit(1)

# 3. 测试路由模块
print("\n3. 测试路由模块:")
try:
    from routes_simple import router
    print("✅ 路由模块导入成功")
    print(f"路由数量: {len(router.routes)}")
except Exception as e:
    print(f"❌ 路由模块导入失败: {e}")
    sys.exit(1)

# 4. 测试FastAPI应用
print("\n4. 测试FastAPI应用:")
try:
    from main import app
    print("✅ FastAPI应用创建成功")
    print(f"应用类型: {type(app)}")
    print(f"路由数量: {len(app.routes)}")
except Exception as e:
    print(f"❌ FastAPI应用创建失败: {e}")
    sys.exit(1)

# 5. 启动服务器
print("\n5. 启动服务器:")
try:
    import uvicorn
    print("开始启动 uvicorn 服务器...")
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000, 
        log_level="info",
        access_log=True
    )
except Exception as e:
    print(f"❌ 服务器启动失败: {e}")
    sys.exit(1) 