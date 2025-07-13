#!/usr/bin/env python3
"""
简单的服务器启动脚本
"""
import uvicorn

if __name__ == "__main__":
    print("启动 FastAPI 服务器...")
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        log_level="debug",
        reload=False
    ) 