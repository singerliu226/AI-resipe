from __future__ import annotations

"""菜谱相关 API 路由（SQLAlchemy 版）

提供：
* GET /api/v1/recipes               获取菜谱分页列表
* GET /api/v1/recipes/{recipe_id}   获取菜谱详情（含食材列表）
"""

import math
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends, Path
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, Recipe, RecipeIngredient, Ingredient
from models import (
    RecipeListResponse,
    RecipeResponse,
    RecipeIngredientResponse,
    IngredientResponse,
)

router = APIRouter()

# ------------------ 列表接口 ------------------
@router.get("/recipes", response_model=RecipeListResponse)
async def get_recipes(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    cuisine: Optional[str] = Query(None, description="菜系过滤"),
    db: AsyncSession = Depends(get_db),
):
    """分页获取菜谱列表"""
    try:
        query = select(Recipe)
        count_query = select(func.count(Recipe.id))

        if search:
            keyword = f"%{search}%"
            query = query.where(Recipe.name.ilike(keyword))
            count_query = count_query.where(Recipe.name.ilike(keyword))

        if cuisine:
            query = query.where(Recipe.cuisine.ilike(f"%{cuisine}%"))
            count_query = count_query.where(Recipe.cuisine.ilike(f"%{cuisine}%"))

        skip = (page - 1) * page_size

        # 总数
        total = (await db.execute(count_query)).scalar() or 0

        # 数据
        rows = await db.execute(query.order_by(Recipe.name).offset(skip).limit(page_size))
        recipes: List[Recipe] = rows.scalars().all()

        recipe_responses = [
            RecipeResponse(
                id=r.id,
                name=r.name,
                calories=r.calories,
                macro_pro=r.macroPro,
                macro_fat=r.macroFat,
                macro_carb=r.macroCarb,
                cuisine=r.cuisine,
                ingredients=[],  # 列表接口不返回食材明细，减少体积
            )
            for r in recipes
        ]

        return RecipeListResponse(
            recipes=recipe_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 1,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"查询菜谱失败: {exc}")


# ------------------ 详情接口 ------------------
@router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: int = Path(..., description="菜谱 ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取菜谱详情，包含食材用量"""
    try:
        stmt = (
            select(Recipe)
            .options(
                selectinload(Recipe.recipe_ingredients).selectinload(RecipeIngredient.ingredient)
            )
            .where(Recipe.id == recipe_id)
        )
        result = await db.execute(stmt)
        recipe: Recipe | None = result.scalar_one_or_none()
        if recipe is None:
            raise HTTPException(status_code=404, detail="菜谱不存在")

        ingredient_items = []
        for ri in recipe.recipe_ingredients:
            ing = ri.ingredient
            ingredient_items.append(
                RecipeIngredientResponse(
                    ingredient=IngredientResponse(
                        id=ing.id,
                        name=ing.name,
                        energy_kcal=ing.energyKcal,
                        protein_g=ing.proteinG,
                        fat_g=ing.fatG,
                        carb_g=ing.carbG,
                        fiber_g=ing.fiberG,
                        calcium_mg=ing.calciumMg,
                        sodium_mg=ing.sodiumMg,
                        seasonality=ing.seasonality,
                    ),
                    quantity=ri.quantity,
                )
            )

        return RecipeResponse(
            id=recipe.id,
            name=recipe.name,
            calories=recipe.calories,
            macro_pro=recipe.macroPro,
            macro_fat=recipe.macroFat,
            macro_carb=recipe.macroCarb,
            cuisine=recipe.cuisine,
            ingredients=ingredient_items,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"获取菜谱详情失败: {exc}") 