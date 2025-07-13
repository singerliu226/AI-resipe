"""数据库连接配置模块

使用 SQLAlchemy 异步引擎连接 PostgreSQL 数据库
提供异步数据库操作接口
"""
import os
from typing import Optional, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Table
from sqlalchemy.orm import relationship
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "env.local"), override=False)
load_dotenv(override=False)

# 获取数据库URL并转换为异步版本
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

# 将postgresql://转换为postgresql+psycopg://并移除schema参数
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")
# 移除psycopg不支持的schema参数
if "?schema=" in ASYNC_DATABASE_URL:
    ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.split("?schema=")[0]

# 创建异步引擎
engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 提供显式初始化函数，避免在导入时阻塞事件循环（解决 uvicorn reload 冲突）
async def init_models() -> None:
    """在应用启动阶段创建数据库表（仅开发环境使用）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

class Base(DeclarativeBase):
    """SQLAlchemy Base类"""
    pass

# 定义数据库模型
class Ingredient(Base):
    """食材模型"""
    __tablename__ = "Ingredient"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    energyKcal = Column(Float, nullable=True)
    proteinG = Column(Float, nullable=True)
    fatG = Column(Float, nullable=True)
    carbG = Column(Float, nullable=True)
    fiberG = Column(Float, nullable=True)
    calciumMg = Column(Float, nullable=True)
    sodiumMg = Column(Float, nullable=True)
    seasonality = Column(String, nullable=True)

class Recipe(Base):
    """菜谱模型"""
    __tablename__ = "Recipe"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    calories = Column(Float, nullable=False)
    macroPro = Column(Float, nullable=False)
    macroFat = Column(Float, nullable=False)
    macroCarb = Column(Float, nullable=False)
    cuisine = Column(String, nullable=True)

class RecipeIngredient(Base):
    """菜谱食材关联模型"""
    __tablename__ = "RecipeIngredient"
    
    recipeId = Column(Integer, ForeignKey("Recipe.id"), primary_key=True)
    ingredientId = Column(Integer, ForeignKey("Ingredient.id"), primary_key=True)
    quantity = Column(Float, nullable=False)
    
    # 关系
    recipe = relationship("Recipe", backref="recipe_ingredients")
    ingredient = relationship("Ingredient", backref="recipe_ingredients")

class RecipeRating(Base):
    """菜谱评分模型"""
    __tablename__ = "RecipeRating"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recipeId = Column(Integer, ForeignKey("Recipe.id"), nullable=False)
    stars = Column(Integer, nullable=False)  # 1-5 星
    comment = Column(String, nullable=True)

    recipe = relationship("Recipe", backref="ratings")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话
    
    Yields:
        AsyncSession: 异步数据库会话
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def close_db():
    """关闭数据库连接"""
    await engine.dispose() 