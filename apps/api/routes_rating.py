from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, Path
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert

from database import get_db, Recipe, RecipeRating

router = APIRouter()

class RatingCreate(BaseModel):
    stars: int = Field(..., ge=1, le=5, description="星级 1-5")
    comment: str | None = Field(None, max_length=300, description="可选评论")

class RatingResponse(BaseModel):
    success: bool

@router.post("/recipes/{recipe_id}/ratings", response_model=RatingResponse)
async def create_rating(
    rating: RatingCreate,
    recipe_id: int = Path(..., description="菜谱 ID"),
    db: AsyncSession = Depends(get_db),
):
    # 验证菜谱存在
    recipe = await db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="菜谱不存在")

    stmt = insert(RecipeRating).values(
        recipeId=recipe_id, stars=rating.stars, comment=rating.comment
    )
    await db.execute(stmt)
    await db.commit()
    return {"success": True} 