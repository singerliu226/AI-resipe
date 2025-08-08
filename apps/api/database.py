"""数据库连接配置模块

使用 SQLAlchemy 异步引擎连接 PostgreSQL 数据库
提供异步数据库操作接口
"""
import os
import csv
from typing import Optional, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy import select
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "env.local"), override=False)
load_dotenv(override=False)

# 获取数据库URL，默认降级至本地 SQLite，确保演示可用
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # 本地演示默认 SQLite 数据库
    default_sqlite_path = os.path.join(os.path.dirname(__file__), "local.db")
    DATABASE_URL = f"sqlite:///{default_sqlite_path}"

IS_SQLITE = DATABASE_URL.startswith("sqlite://")

if IS_SQLITE:
    # 异步 SQLite 驱动
    ASYNC_DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://")
else:
    # 将postgresql://转换为postgresql+psycopg://并移除schema参数
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")
    if "?schema=" in ASYNC_DATABASE_URL:
        ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.split("?schema=")[0]

# 创建异步引擎
kwargs = {"echo": False}
if IS_SQLITE:
    kwargs["connect_args"] = {"check_same_thread": False}
engine = create_async_engine(ASYNC_DATABASE_URL, **kwargs)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 提供显式初始化函数，避免在导入时阻塞事件循环（解决 uvicorn reload 冲突）
from sqlalchemy.exc import OperationalError

async def _maybe_seed_sqlite() -> None:
    """SQLite 空库时自动注入演示数据。"""
    from sqlalchemy import func
    async with AsyncSessionLocal() as session:
        total = (await session.execute(select(func.count(Recipe.id)))).scalar() or 0
        if total > 0:
            return
        ing_apple = Ingredient(name="苹果", energyKcal=52, proteinG=0.3, fatG=0.2, carbG=14.0)
        ing_chicken = Ingredient(name="鸡胸肉", energyKcal=165, proteinG=31.0, fatG=3.6, carbG=0.0)
        session.add_all([ing_apple, ing_chicken])
        await session.flush()
        r1 = Recipe(name="鸡胸肉三明治", calories=360, macroPro=35, macroFat=8, macroCarb=35, cuisine="Western")
        r2 = Recipe(name="苹果燕麦粥", calories=280, macroPro=8, macroFat=6, macroCarb=50, cuisine="Chinese")
        session.add_all([r1, r2])
        await session.flush()
        session.add_all([
            RecipeIngredient(recipeId=r1.id, ingredientId=ing_chicken.id, quantity=150.0),
            RecipeIngredient(recipeId=r2.id, ingredientId=ing_apple.id, quantity=120.0),
        ])
        await session.commit()

async def _seed_from_csv_if_empty() -> None:
    """当菜谱表为空时，尝试从 CSV 导入一批演示数据。

    - 优先使用中文 `recipes_cn.csv`，否则使用英文 `recipes.csv`
    - 为每个菜谱填充默认热量和三大营养素占比，满足非空约束
    - 为每个菜谱关联一个通用食材，保证详情页可展示
    """
    from sqlalchemy import func

    data_dir = os.path.join(os.path.dirname(__file__), "data")
    cn_csv = os.path.join(data_dir, "recipes_cn.csv")
    en_csv = os.path.join(data_dir, "recipes.csv")
    csv_path = cn_csv if os.path.exists(cn_csv) else (en_csv if os.path.exists(en_csv) else None)
    if not csv_path:
        return

    async with AsyncSessionLocal() as session:
        total = (await session.execute(select(func.count(Recipe.id)))).scalar() or 0
        if total > 0:
            return

        # 准备通用食材
        generic = (await session.execute(select(Ingredient).where(Ingredient.name == "示例食材"))).scalar_one_or_none()
        if generic is None:
            generic = Ingredient(name="示例食材", energyKcal=100.0, proteinG=5.0, fatG=3.0, carbG=12.0)
            session.add(generic)
            await session.flush()

        # 读取前 50 条记录，字段差异：
        # - 中文 CSV: id,name,url,category,ingredients,steps
        # - 英文 CSV: id,name,category,area,instructions,thumbnail
        # 由于模型需要热量与三大营养素，采用演示默认值（更接近普通家常餐）
        DEFAULT_CAL = 420.0
        DEFAULT_PRO = 25.0
        DEFAULT_FAT = 12.0
        DEFAULT_CARB = 55.0

        added = 0
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get("name") or row.get("Name")
                    if not name:
                        continue
                    cuisine = row.get("category") or row.get("area") or None

                    recipe = Recipe(
                        name=str(name)[:128],
                        calories=DEFAULT_CAL,
                        macroPro=DEFAULT_PRO,
                        macroFat=DEFAULT_FAT,
                        macroCarb=DEFAULT_CARB,
                        cuisine=(str(cuisine)[:64] if cuisine else None),
                    )
                    session.add(recipe)
                    await session.flush()

                    # 关联 1 个通用食材，数量给个演示值
                    session.add(
                        RecipeIngredient(recipeId=recipe.id, ingredientId=generic.id, quantity=100.0)
                    )

                    added += 1
                    if added >= 50:
                        break

            await session.commit()
        except UnicodeDecodeError:
            # 兼容 utf-8-sig
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get("name") or row.get("Name")
                    if not name:
                        continue
                    cuisine = row.get("category") or row.get("area") or None

                    recipe = Recipe(
                        name=str(name)[:128],
                        calories=DEFAULT_CAL,
                        macroPro=DEFAULT_PRO,
                        macroFat=DEFAULT_FAT,
                        macroCarb=DEFAULT_CARB,
                        cuisine=(str(cuisine)[:64] if cuisine else None),
                    )
                    session.add(recipe)
                    await session.flush()

                    session.add(
                        RecipeIngredient(recipeId=recipe.id, ingredientId=generic.id, quantity=100.0)
                    )

                    added += 1
                    if added >= 50:
                        break
            await session.commit()

async def init_models() -> None:
    """在应用启动阶段创建数据库表。
    若 PostgreSQL 连接失败，则自动回退到 SQLite，并继续启动（演示友好）。
    """
    global engine, AsyncSessionLocal, IS_SQLITE, ASYNC_DATABASE_URL
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except OperationalError:
        # 回退到 SQLite
        default_sqlite_path = os.path.join(os.path.dirname(__file__), "local.db")
        DATABASE_URL_FALLBACK = f"sqlite:///{default_sqlite_path}"
        ASYNC_DATABASE_URL = DATABASE_URL_FALLBACK.replace("sqlite://", "sqlite+aiosqlite://")
        IS_SQLITE = True
        kwargs = {"echo": False, "connect_args": {"check_same_thread": False}}
        engine = create_async_engine(ASYNC_DATABASE_URL, **kwargs)
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # 无论何种数据库，若为空则尝试导入演示数据
    try:
        await _seed_from_csv_if_empty()
    except Exception:
        # SQLite 仍保留最小示例兜底
        if IS_SQLITE:
            try:
                await _maybe_seed_sqlite()
            except Exception:
                pass

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