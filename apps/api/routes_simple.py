"""简化版 API 路由

提供基本的食材查询接口
"""
import math
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db, Ingredient
from models import IngredientResponse, IngredientListResponse

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
        query = select(Ingredient).where(Ingredient.id == ingredient_id)
        result = await db.execute(query)
        ingredient = result.scalar_one_or_none()
        
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

@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "message": "API服务运行正常"} 