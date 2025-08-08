"""FastAPI + DsPy 微服务入口.

此服务用于利用 DsPy 调用大模型，生成对推荐结果的自然语言解释，以及后续算法实验接口。

运行方式：
    uvicorn apps.api.main:app --reload

环境变量：
    OPENAI_API_KEY: OpenAI API 密钥
"""
from __future__ import annotations

import os
from typing import List, Dict, Union

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

import csv
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

# openai 库可选导入（仅当需要配置 OPENAI_API_BASE 时才真正使用）
try:  # pragma: no cover - 依赖可选
    import openai  # type: ignore
except Exception:  # noqa: BLE001 - 容忍任何导入问题
    openai = None  # type: ignore

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
# LLM 提供者（惰性初始化，优先 DsPy，回退 OpenAI SDK）
# -----------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")

_lm_infer = None  # type: ignore[var-annotated]

def ensure_lm_configured() -> None:
    """在首次需要时配置 LLM，避免应用启动阶段因缺少密钥失败。

    优先尝试 dspy.LM；若 dspy 导入失败，则回退到 openai SDK。
    """
    global _lm_infer
    if _lm_infer is not None:
        return

    api_key = os.getenv("OPENAI_API_KEY") or OPENAI_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY 未配置，无法生成 AI 解释")

    os.environ.setdefault("OPENAI_API_KEY", api_key)

    if OPENAI_API_BASE:
        os.environ.setdefault("OPENAI_API_BASE", OPENAI_API_BASE)
        if openai is not None:
            # openai<1.0
            if hasattr(openai, "api_base"):
                try:
                    openai.api_base = OPENAI_API_BASE  # type: ignore[attr-defined]
                except Exception:
                    pass
            # openai>=1.0
            if hasattr(openai, "base_url"):
                try:
                    openai.base_url = OPENAI_API_BASE  # type: ignore[attr-defined]
                except Exception:
                    pass

    # 尝试 dspy
    try:
        import dspy  # type: ignore
        from dspy import LM  # type: ignore

        model_name = os.getenv("DSPY_MODEL", "deepseek/deepseek-chat")
        lm_instance = LM(model_name, temperature=0.7, max_tokens=512)
        def _infer_with_dspy(prompt: str) -> str:
            return lm_instance(prompt)[0].strip()

        _lm_infer = _infer_with_dspy
        return
    except Exception:
        # 回退 openai SDK
        pass

    if openai is None:
        raise HTTPException(status_code=503, detail="未安装 openai/dspy，无法生成 AI 解释")

    # openai>=1.0 优先
    if hasattr(openai, "OpenAI"):
        try:
            Client = openai.OpenAI  # type: ignore[attr-defined]
            client = Client(api_key=os.environ["OPENAI_API_KEY"], base_url=os.getenv("OPENAI_API_BASE"))
            model = os.getenv("OPENAI_MODEL", os.getenv("DSPY_MODEL", "gpt-4o"))
            def _infer_with_openai_v1(prompt: str) -> str:
                chat = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=512,
                )
                return (chat.choices[0].message.content or "").strip()
            _lm_infer = _infer_with_openai_v1
            return
        except Exception:
            pass

    # openai<1.0 兼容
    if hasattr(openai, "ChatCompletion"):
        try:
            def _infer_with_openai_legacy(prompt: str) -> str:
                resp = openai.ChatCompletion.create(
                    model=os.getenv("OPENAI_MODEL", os.getenv("DSPY_MODEL", "gpt-3.5-turbo")),
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=512,
                )
                return resp["choices"][0]["message"]["content"].strip()
            _lm_infer = _infer_with_openai_legacy
            return
        except Exception:
            pass

    raise HTTPException(status_code=503, detail="LLM 初始化失败，请检查依赖与密钥配置")

def generate_explanation(user_profile: str, recipes: str) -> str:
    """基于 LLM 生成中文解释。

    不依赖 dspy.Module，避免导入期依赖冲突；在函数内部统一构造 prompt 并调用 `_lm_infer`。
    """
    ensure_lm_configured()

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

    print("PROMPT=>", prompt_text)
    return _lm_infer(prompt_text)  # type: ignore[misc]

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
    allow_origins=["*"],  # 演示与部署环境允许任意来源访问
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        result = generate_explanation(user_profile=user_str, recipes=recipe_str)
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