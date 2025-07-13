#!/usr/bin/env python3
"""
数据库连接测试脚本
"""
import os
import sys
import asyncio
from pathlib import Path

# 添加apps/api到Python路径
api_path = Path(__file__).parent.parent / "apps" / "api"
sys.path.insert(0, str(api_path))

from dotenv import load_dotenv
from sqlalchemy import text

# 加载环境变量
load_dotenv(api_path / "env.local")

try:
    from database import engine
    print("✅ 数据库引擎创建成功")
    
    async def test_connection():
        try:
            async with engine.begin() as conn:
                result = await conn.execute(text("SELECT 1"))
                print(f"✅ 数据库连接测试成功: {result.scalar()}")
                return True
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            return False
    
    # 运行测试
    success = asyncio.run(test_connection())
    if success:
        print("🎉 数据库连接完全正常")
        sys.exit(0)
    else:
        sys.exit(1)
        
except Exception as e:
    print(f"❌ 数据库模块导入失败: {e}")
    sys.exit(1) 