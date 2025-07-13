"""API 路由定义

提供食材和菜谱的查询接口，支持分页和过滤
"""
import math
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from database import get_db, Ingredient, Recipe, RecipeIngredient
from models import (
    IngredientResponse, 
    RecipeResponse, 
    IngredientListResponse, 
    RecipeListResponse,
    RecipeIngredientResponse
)

router = APIRouter()

@router.get("/ingredients", response_model=IngredientListResponse)
async def get_ingredients(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    has_nutrition: Optional[bool] = Query(None, description="是否有营养数据"),
    db: AsyncSession = Depends(get_db)
):
    """获取食材列表
    
    支持分页查询和关键词搜索
    可以筛选是否包含营养数据的食材
    """
    try:
        # 构建查询条件
        query = select(Ingredient)
        count_query = select(func.count(Ingredient.id))
        
        if search:
            search_filter = Ingredient.name.ilike(f"%{search}%")
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        if has_nutrition is not None:
            if has_nutrition:
                nutrition_filter = Ingredient.energyKcal.is_not(None)
            else:
                nutrition_filter = Ingredient.energyKcal.is_(None)
            query = query.where(nutrition_filter)
            count_query = count_query.where(nutrition_filter)
        
        # 计算偏移量
        skip = (page - 1) * page_size
        
        # 查询总数
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 查询数据
        query = query.order_by(Ingredient.name).offset(skip).limit(page_size)
        result = await db.execute(query)
        ingredients = result.scalars().all()
        
        # 转换为响应模型
        ingredient_responses = [
            IngredientResponse(
                id=ing.id,
                name=ing.name,
                energy_kcal=ing.energyKcal,
                protein_g=ing.proteinG,
                fat_g=ing.fatG,
                carb_g=ing.carbG,
                fiber_g=ing.fiberG,
                calcium_mg=ing.calciumMg,
                sodium_mg=ing.sodiumMg,
                seasonality=ing.seasonality
            )
            for ing in ingredients
        ]
        
        total_pages = math.ceil(total / page_size)
        
        return IngredientListResponse(
            ingredients=ingredient_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询食材失败: {str(e)}")

@router.get("/ingredients/{ingredient_id}", response_model=IngredientResponse)
async def get_ingredient(
    ingredient_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取单个食材详情"""
    try:
        ingredient = await prisma.ingredient.find_unique(
            where={"id": ingredient_id}
        )
        
        if not ingredient:
            raise HTTPException(status_code=404, detail="食材不存在")
        
        return IngredientResponse(
            id=ingredient.id,
            name=ingredient.name,
            energy_kcal=ingredient.energyKcal,
            protein_g=ingredient.proteinG,
            fat_g=ingredient.fatG,
            carb_g=ingredient.carbG,
            fiber_g=ingredient.fiberG,
            calcium_mg=ingredient.calciumMg,
            sodium_mg=ingredient.sodiumMg,
            seasonality=ingredient.seasonality
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询食材失败: {str(e)}")

@router.get("/recipes", response_model=RecipeListResponse)
async def get_recipes(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    cuisine: Optional[str] = Query(None, description="菜系筛选"),
    min_calories: Optional[float] = Query(None, description="最小热量"),
    max_calories: Optional[float] = Query(None, description="最大热量"),
    prisma: Prisma = Depends(get_prisma)
):
    """获取菜谱列表
    
    支持分页查询、关键词搜索和多维度筛选
    """
    try:
        # 构建查询条件
        where_conditions = {}
        
        if search:
            where_conditions["name"] = {"contains": search}
        
        if cuisine:
            where_conditions["cuisine"] = {"contains": cuisine}
        
        if min_calories is not None or max_calories is not None:
            calories_filter = {}
            if min_calories is not None:
                calories_filter["gte"] = min_calories
            if max_calories is not None:
                calories_filter["lte"] = max_calories
            where_conditions["calories"] = calories_filter
        
        # 计算偏移量
        skip = (page - 1) * page_size
        
        # 查询总数
        total = await prisma.recipe.count(where=where_conditions)
        
        # 查询数据
        recipes = await prisma.recipe.find_many(
            where=where_conditions,
            skip=skip,
            take=page_size,
            order={"name": "asc"}
        )
        
        # 转换为响应模型
        recipe_responses = [
            RecipeResponse(
                id=recipe.id,
                name=recipe.name,
                calories=recipe.calories,
                macro_pro=recipe.macroPro,
                macro_fat=recipe.macroFat,
                macro_carb=recipe.macroCarb,
                cuisine=recipe.cuisine,
                ingredients=[]  # 简化版不包含食材详情
            )
            for recipe in recipes
        ]
        
        total_pages = math.ceil(total / page_size)
        
        return RecipeListResponse(
            recipes=recipe_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询菜谱失败: {str(e)}")

@router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: int,
    prisma: Prisma = Depends(get_prisma)
):
    """获取单个菜谱详情，包含完整的食材信息"""
    try:
        recipe = await prisma.recipe.find_unique(
            where={"id": recipe_id},
            include={
                "ingredients": {
                    "include": {
                        "ingredient": True
                    }
                }
            }
        )
        
        if not recipe:
            raise HTTPException(status_code=404, detail="菜谱不存在")
        
        # 转换食材信息
        ingredient_responses = [
            RecipeIngredientResponse(
                ingredient=IngredientResponse(
                    id=ri.ingredient.id,
                    name=ri.ingredient.name,
                    energy_kcal=ri.ingredient.energyKcal,
                    protein_g=ri.ingredient.proteinG,
                    fat_g=ri.ingredient.fatG,
                    carb_g=ri.ingredient.carbG,
                    fiber_g=ri.ingredient.fiberG,
                    calcium_mg=ri.ingredient.calciumMg,
                    sodium_mg=ri.ingredient.sodiumMg,
                    seasonality=ri.ingredient.seasonality
                ),
                quantity=ri.quantity
            )
            for ri in recipe.ingredients
        ]
        
        return RecipeResponse(
            id=recipe.id,
            name=recipe.name,
            calories=recipe.calories,
            macro_pro=recipe.macroPro,
            macro_fat=recipe.macroFat,
            macro_carb=recipe.macroCarb,
            cuisine=recipe.cuisine,
            ingredients=ingredient_responses
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询菜谱失败: {str(e)}") 