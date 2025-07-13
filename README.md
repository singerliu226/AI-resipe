# 智能食谱 MVP

基于营养数据和用户偏好的智能食谱推荐系统。

## 项目架构

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js + React
- **Database**: PostgreSQL (Docker)
- **AI**: DSPy + DeepSeek API

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pnpm install

# 启动PostgreSQL数据库
docker start smart-recipe-postgres
```

### 2. 启动开发环境

**方式一：使用启动脚本（推荐）**
```bash
./scripts/start-dev.sh
```

**方式二：使用Makefile**
```bash
# 测试数据库连接
make test-db

# 启动API服务器
make dev-api

# 健康检查
make health-check
```

**方式三：手动启动**
```bash
# 在项目根目录执行
uvicorn main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8000
```

### 3. 验证服务

- API健康检查: http://localhost:8000/api/v1/health
- 食材列表: http://localhost:8000/api/v1/ingredients
- API文档: http://localhost:8000/docs

## 问题解决方案

### 常见问题及解决方案

1. **"Could not import module 'main'"**
   - 原因：在错误目录执行uvicorn命令
   - 解决：使用 `uvicorn main:app --app-dir apps/api` 或在项目根目录使用完整路径

2. **"DATABASE_URL environment variable is required"**
   - 原因：环境变量未正确加载
   - 解决：确保 `apps/api/env.local` 包含正确的数据库连接字符串

3. **数据库连接失败**
   - 原因：Docker容器未启动或密码错误
   - 解决：检查容器状态，确认连接参数

4. **Prisma Studio报错**
   - 原因：项目已迁移到SQLAlchemy
   - 解决：忽略此错误或使用PostgreSQL客户端工具

### 技术栈迁移记录

- ✅ **Prisma** → **SQLAlchemy**: 解决Python 3.13兼容性问题
- ✅ **asyncpg** → **psycopg3**: 解决编译错误
- ✅ 数据库连接: PostgreSQL运行在端口5433，避免冲突

## 数据状态

- ✅ 食材数据：1438条记录已导入
- ✅ 营养信息：完整的热量、蛋白质、脂肪、碳水等数据
- ✅ API接口：食材列表、搜索、详情等功能正常

## 开发命令

```bash
# 数据库相关
make test-db                 # 测试数据库连接
docker start smart-recipe-postgres  # 启动数据库

# API服务
make dev-api                 # 开发模式启动
make start-api               # 生产模式启动
make health-check           # 健康检查
make clean                  # 清理进程

# 开发脚本
./scripts/start-dev.sh      # 一键启动开发环境
python scripts/test-db.py   # 测试数据库连接
```

## 项目状态

- ✅ 数据层：食材数据已完整导入
- ✅ API层：核心接口开发完成并测试通过
- 🔄 推荐算法：待开发
- 🔄 前端UI：待开发
- 🔄 部署配置：待配置

## 贡献指南

1. 确保所有测试通过
2. 遵循代码规范和注释要求
3. 更新相关文档 