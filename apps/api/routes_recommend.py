"""推荐算法 API 路由

根据用户营养目标 & 口味标签，输出早餐 / 午餐 / 晚餐三份推荐菜谱

算法思路（简化版）：
1. 内容基础：计算菜谱热量与目标热量差异、宏量营养素差异
2. 口味标签：若菜谱的 `cuisine` 包含用户标签则加权
3. 协同过滤（占位）：真实项目可根据用户历史喜好，再做二次排序；此处返回随机扰动
"""
from __future__ import annotations

import random
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from functools import lru_cache

# ------------------ 简单缓存 ------------------
# 根据 (kcal_targets, macro配比, taste_tags 排序后tuple) 作为 key 缓存 30 分钟
import time

_CACHE_TTL = 1800  # 秒

_recommend_cache: dict[tuple, tuple[float, RecommendResponse]] = {}


# ------------------ 修改评分权重 ------------------
# 在 pick_recipe 中加入 rating_dict 参数

from database import get_db, Recipe, RecipeRating

router = APIRouter()

# ------------------ 请求 / 响应模型 ------------------
class UserProfile(BaseModel):
    """用户信息&目标"""
    daily_calories: float = Field(..., description="每日目标热量 kcal")
    macro_pro: float = Field(0.3, description="蛋白质比例 0-1")
    macro_fat: float = Field(0.3, description="脂肪比例 0-1")
    macro_carb: float = Field(0.4, description="碳水比例 0-1")
    taste_tags: List[str] = Field(default=[], description="口味 / 菜系 偏好标签")

class MealRecipe(BaseModel):
    meal: str
    recipe_id: int
    recipe_name: str
    calories: float

class RecommendResponse(BaseModel):
    breakfast: MealRecipe
    lunch: MealRecipe
    dinner: MealRecipe

# ------------------ 内部工具函数 ------------------

def _macro_distance(r: Recipe, target_pro: float, target_fat: float, target_carb: float) -> float:
    """计算菜谱宏量营养占比与目标占比的欧氏距离"""
    total_macro = r.macroPro + r.macroFat + r.macroCarb
    if total_macro == 0:
        return 1e6
    pro_ratio = r.macroPro / total_macro
    fat_ratio = r.macroFat / total_macro
    carb_ratio = r.macroCarb / total_macro
    return ((pro_ratio - target_pro) ** 2 + (fat_ratio - target_fat) ** 2 + (carb_ratio - target_carb) ** 2) ** 0.5

async def _pick_recipe(
    recipes: List[Recipe],
    kcal_target: float,
    target_pro: float,
    target_fat: float,
    target_carb: float,
    taste_tags: List[str],
    rating_dict: dict[int, float],
) -> Optional[Recipe]:
    """从候选菜谱中挑选与目标最匹配的一道"""
    candidates: List[tuple[Recipe, float]] = []
    for r in recipes:
        # 热量差异权重
        kcal_diff = abs(r.calories - kcal_target) / kcal_target
        if kcal_diff > 0.5:  # 超过50%热量差，直接丢弃
            continue
        score = kcal_diff  # 越小越好
        # 宏量差异
        score += _macro_distance(r, target_pro, target_fat, target_carb)
        # 口味匹配奖励
        if r.cuisine and any(tag.lower() in r.cuisine.lower() for tag in taste_tags):
            score *= 0.8  # 奖励系数
        # 评分奖励：平均星级>3.5 奖励系数 0.9；<2.5 惩罚 1.1
        avg_star = rating_dict.get(r.id, 0)
        if avg_star >= 4:
            score *= 0.8
        elif avg_star >= 3.5:
            score *= 0.9
        elif 0 < avg_star < 2.5:
            score *= 1.1

        # 加入随机扰动避免每次都一样
        score *= random.uniform(0.9, 1.1)
        candidates.append((r, score))
    if not candidates:
        return None
    # 取分数最小的
    candidates.sort(key=lambda x: x[1])
    return candidates[0][0]

# ------------------ API 路由 ------------------
@router.post("/recommend", response_model=RecommendResponse)
async def recommend_meals(profile: UserProfile, db: AsyncSession = Depends(get_db)):
    """根据用户营养目标推荐早餐 / 午餐 / 晚餐三道菜谱"""
    try:
        # 简易缓存检查
        cache_key = (
            profile.daily_calories,
            round(profile.macro_pro, 2),
            round(profile.macro_fat, 2),
            round(profile.macro_carb, 2),
            tuple(sorted(profile.taste_tags)),
        )
        now_ts = time.time()
        cached = _recommend_cache.get(cache_key)
        if cached and now_ts - cached[0] < _CACHE_TTL:
            return cached[1]

        # 读取所有菜谱（真实场景应分页或缓存）
        result = await db.execute(select(Recipe))
        all_recipes: List[Recipe] = result.scalars().all()
        if not all_recipes:
            raise HTTPException(status_code=500, detail="菜谱数据为空")

        # 读取平均评分
        rating_rows = await db.execute(
            select(RecipeRating.recipeId, func.avg(RecipeRating.stars)).group_by(RecipeRating.recipeId)
        )
        rating_dict = {r[0]: float(r[1]) for r in rating_rows.all()}

        # 计算每餐目标热量
        kcal_targets = {
            "breakfast": profile.daily_calories * 0.3,
            "lunch": profile.daily_calories * 0.4,
            "dinner": profile.daily_calories * 0.3,
        }
        meal_recipes: Dict[str, Optional[Recipe]] = {}
        for meal, kcal_target in kcal_targets.items():
            picked = _pick_recipe(
                all_recipes,
                kcal_target,
                profile.macro_pro,
                profile.macro_fat,
                profile.macro_carb,
                profile.taste_tags,
                rating_dict,
            )
            meal_recipes[meal] = picked

        # 构造响应
        def to_meal(meal_name: str, r: Optional[Recipe]) -> MealRecipe:
            if r is None:
                return MealRecipe(meal=meal_name, recipe_id=-1, recipe_name="未找到合适菜谱", calories=0)
            return MealRecipe(meal=meal_name, recipe_id=r.id, recipe_name=r.name, calories=r.calories)

        response = RecommendResponse(
            breakfast=to_meal("breakfast", meal_recipes["breakfast"]),
            lunch=to_meal("lunch", meal_recipes["lunch"]),
            dinner=to_meal("dinner", meal_recipes["dinner"]),
        )

        # 写入缓存
        _recommend_cache[cache_key] = (now_ts, response)
        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推荐生成失败: {str(e)}") 