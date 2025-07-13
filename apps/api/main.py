"""FastAPI + DsPy 微服务入口.

此服务用于利用 DsPy 调用大模型，生成对推荐结果的自然语言解释，以及后续算法实验接口。

运行方式：
    uvicorn apps.api.main:app --reload

环境变量：
    OPENAI_API_KEY: OpenAI API 密钥
"""
from __future__ import annotations

import os
import openai  # type: ignore
from typing import List, Dict, Union

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import dspy  # type: ignore
from dspy import LM  # type: ignore
from dotenv import load_dotenv

import csv
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

# 导入新的模块
from database import close_db
from routes_simple import router as api_router
from routes_recommend import router as recommend_router
from routes_rating import router as rating_router
from routes_recipes import router as recipes_router
# 初始化表
from database import init_models

# 优先读取同目录下 env.local，其次读取默认 .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "env.local"), override=False)
load_dotenv(override=False)

# -----------------------
# DsPy 配置
# -----------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")

# 兼容 DeepSeek 等 OpenAI 协议供应商
if OPENAI_API_BASE:
    # openai<1.0
    if hasattr(openai, "api_base"):
        openai.api_base = OPENAI_API_BASE  # type: ignore[attr-defined]
    # openai>=1.0
    if hasattr(openai, "base_url"):
        openai.base_url = OPENAI_API_BASE  # type: ignore[attr-defined]

if not OPENAI_API_KEY:
    raise RuntimeError("Environment variable OPENAI_API_KEY is required for DsPy.")

# 配置 LLM
# 使用 dspy.LM 实例（LiteLLM Provider）。Model 名称需符合 litellm 语法，如 "openai/gpt-4o"。
# 若使用 DeepSeek，仍以 openai/ 前缀，底层仅透传到 OPENAI_API_BASE。

os.environ.setdefault("OPENAI_API_KEY", OPENAI_API_KEY)
if OPENAI_API_BASE:
    os.environ.setdefault("OPENAI_API_BASE", OPENAI_API_BASE)

lm_instance = LM("deepseek/deepseek-chat", temperature=0.7, max_tokens=512)
dspy.settings.configure(lm=lm_instance)

# Define a simple module for explanation generation
class ExplainModule(dspy.Module):
    """根据菜谱与用户画像生成解释文本"""

    def __init__(self):
        super().__init__()

        # 使用 Predict 创建带指令的 Signature
        instructions = (
            "你是一名注册营养师，请严格只用中文回答。"
            "请依据 `user_profile` 和 `recipes`，输出 3 段，每段以数字+顿号开头：\n"
            "1、热量与宏量营养素概述；\n"
            "2、推荐理由；\n"
            "3、注意事项；\n"
            "总字数 60~120 字，任何情况下禁止出现英文单词或拼音。"
        )
        self.explain = dspy.Predict(
            "user_profile, recipes -> explanation", instructions=instructions
        )

    def forward(self, user_profile: str, recipes: str):  # type: ignore[override]
        lm = dspy.settings.lm  # 当前注册的 LM

        # 构造中文 prompt
        prompt_text = (
            "你是一名注册营养师，请严格只用中文回答。\n"
            "请依据以下信息生成 60-120 字、三行格式的推荐解释：\n"
            "1、热量与宏量营养素概述；\n"
            "2、推荐理由；\n"
            "3、注意事项。\n\n"
            f"用户画像: {user_profile}\n"
            f"推荐菜谱: {recipes}\n"
            "禁止使用任何英文单词或拼音。"
        )

        print("PROMPT=>", prompt_text)  # 调试输出

        # 调用大模型
        response = lm(prompt_text)[0]
        return response.strip()


explain_module = ExplainModule()

# -----------------------
# FastAPI 生命周期管理
# -----------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时连接数据库，关闭时断开连接"""
    # 启动时初始化数据库表
    await init_models()
    yield
    # 关闭时断开数据库连接
    await close_db()

# -----------------------
# FastAPI definition
# -----------------------
app = FastAPI(
    title="智能食谱 API 服务", 
    version="0.1.0",
    description="提供食材、菜谱查询和 AI 推荐解释功能",
    lifespan=lifespan
)

# 允许本地前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class Recipe(BaseModel):
    id: int
    name: str
    calories: float
    macro: Dict[str, float]


class ExplainRequest(BaseModel):
    user_profile: Dict[str, Union[str, int, float]]
    recipes: List[Recipe]


class ExplainResponse(BaseModel):
    explanation: str


@app.post("/explain", response_model=ExplainResponse)
async def explain(req: ExplainRequest):
    """返回对推荐菜谱的 AI 解释"""
    try:
        user_str = ", ".join([f"{k}:{v}" for k, v in req.user_profile.items()])
        recipe_str = "; ".join([f"{r.name}({r.calories}kcal)" for r in req.recipes])
        result = explain_module(user_profile=user_str, recipes=recipe_str)
        return {"explanation": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


DATA_DIR = Path(__file__).resolve().parent / "data"
RECIPES_CSV = DATA_DIR / "recipes.csv"

# 预加载 CSV 以加速响应；若文件不存在则返回空列表。
if RECIPES_CSV.exists():
    with RECIPES_CSV.open(newline="", encoding="utf-8") as f:
        _recipes_cache = list(csv.DictReader(f))
else:
    _recipes_cache: list[dict] = []


# 注册 API 路由
app.include_router(api_router, prefix="/api/v1", tags=["食材和菜谱"])
app.include_router(recommend_router, prefix="/api/v1", tags=["推荐"])
app.include_router(rating_router, prefix="/api/v1", tags=["评分"])
app.include_router(recipes_router, prefix="/api/v1", tags=["菜谱"])

@app.get("/recipes")
async def get_recipes():
    """返回 CSV 中的全部菜谱数据。（兼容性接口）"""
    return _recipes_cache 