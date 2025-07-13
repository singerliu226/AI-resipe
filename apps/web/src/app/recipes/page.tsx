"use client";

import { api, Recipe } from "@/utils/api";
import RecipeCard from "@/components/RecipeCard";
import { useEffect, useState } from "react";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    api
      .getRecipes({ page_size: 30 })
      .then((data) => {
        if (!canceled) {
          setRecipes(data.recipes);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (!canceled) {
          setError(e.message || "加载失败");
          setLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (loading) return <p className="p-4">加载中...</p>;
  if (error)
    return <p className="p-4 text-red-500">无法加载菜谱数据：{error}</p>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">全部菜谱</h1>
      {recipes.length === 0 ? (
        <p>暂无数据</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={{ id: r.id, name: r.name, calories: r.calories }}
              href={`/recipes/${r.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
} 