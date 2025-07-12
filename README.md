# 智能食谱 Demo Monorepo

> Next.js + Supabase + FastAPI(DsPy) 全栈示例，实现个性化食谱推荐。

## 目录结构
```
智能食谱/
├─ apps/
│  ├─ web/        # Next.js 14 (App Router)
│  └─ api/        # FastAPI + DsPy 服务
├─ packages/
│  └─ logger/     # Winston 通用日志模块
├─ prisma/        # 数据模型与迁移
├─ scripts/       # 自动化脚本
└─ .github/       # CI / LLM 预审
```

## 快速开始
```bash
pnpm install          # 安装前端 / node 依赖
pip install -r apps/api/requirements.txt   # 安装后端依赖

# 配置环境变量
cp apps/api/env.local .env                 # DeepSeek/OpenAI Key
export DATABASE_URL="postgresql://user:pass@host/db"  # 本地数据库

# 生成 Prisma Client & 迁移
pnpm prisma:migrate
pnpm prisma:generate

# 并行启动
pnpm dev            # 前端 3000 + 后端 8000
```

## 主要脚本
| 命令 | 说明 |
| ---- | ---- |
| `pnpm dev` | 并行启动 web 与 api 热更新 |
| `pnpm dev:web` / `pnpm dev:api` | 单独启动子项目 |
| `pnpm prisma:migrate` | 本地迁移数据库 |
| `pnpm conv:upload` | 上传 .cursor_history 至 Supabase Storage |
| `pnpm llm:review` | 本地运行 LLM 预审脚本 |

## 环境变量
### 通用
| 名称 | 说明 |
| ---- | ---- |
| `NEXT_PUBLIC_API_BASE_URL` | 前端调用后端地址，默认 `http://localhost:8000` |

### Backend `apps/api`
| 名称 | 说明 |
| ---- | ---- |
| `OPENAI_API_KEY` | DeepSeek／OpenAI 兼容 Key |
| `OPENAI_API_BASE` | DeepSeek 网关，如 `https://api.deepseek.com/v1` |
| `DATABASE_URL` | PostgreSQL 连接串 |

### Supabase Conversation Logger
| 名称 | 说明 |
| ---- | ---- |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | service_role Key，用于上传对话日志 |

## GitHub Actions
`.github/workflows/llm_review.yml` 在 PR 打开/更新时自动运行 LLM 代码评审，需在仓库 Secrets 设置 `OPENAI_API_KEY`。

## 部署
1. **前端**：Vercel → 设置 `NEXT_PUBLIC_API_BASE_URL` 指向后端。
2. **后端**：Railway / Fly.io 部署 FastAPI，配置 `OPENAI_API_KEY`、`DATABASE_URL`。
3. **数据库**：Supabase Postgres 或自建 Postgres。

---
© 2025 Smart Recipe Demo 