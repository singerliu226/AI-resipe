"""API 响应模型定义

定义 FastAPI 接口的请求和响应数据结构
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class IngredientResponse(BaseModel):
    """食材响应模型"""
    id: int
    name: str
    energy_kcal: Optional[float] = Field(None, description="每100g热量(kcal)")
    protein_g: Optional[float] = Field(None, description="每100g蛋白质(g)")
    fat_g: Optional[float] = Field(None, description="每100g脂肪(g)")
    carb_g: Optional[float] = Field(None, description="每100g碳水化合物(g)")
    fiber_g: Optional[float] = Field(None, description="每100g膳食纤维(g)")
    calcium_mg: Optional[float] = Field(None, description="每100g钙(mg)")
    sodium_mg: Optional[float] = Field(None, description="每100g钠(mg)")
    seasonality: Optional[str] = Field(None, description="季节性")

class RecipeIngredientResponse(BaseModel):
    """菜谱食材响应模型"""
    ingredient: IngredientResponse
    quantity: float = Field(description="用量(g)")

class RecipeResponse(BaseModel):
    """菜谱响应模型"""
    id: int
    name: str
    calories: float = Field(description="总热量(kcal)")
    macro_pro: float = Field(description="蛋白质含量(g)")
    macro_fat: float = Field(description="脂肪含量(g)")
    macro_carb: float = Field(description="碳水化合物含量(g)")
    cuisine: Optional[str] = Field(None, description="菜系")
    ingredients: List[RecipeIngredientResponse] = Field(default=[], description="食材列表")

class RecipeListResponse(BaseModel):
    """菜谱列表响应模型"""
    recipes: List[RecipeResponse]
    total: int = Field(description="总数量")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")

class IngredientListResponse(BaseModel):
    """食材列表响应模型"""
    ingredients: List[IngredientResponse]
    total: int = Field(description="总数量")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    total_pages: int = Field(description="总页数")

class ErrorResponse(BaseModel):
    """错误响应模型"""
    detail: str = Field(description="错误详情")
    code: Optional[str] = Field(None, description="错误代码") 