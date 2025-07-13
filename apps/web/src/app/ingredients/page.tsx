"use client";

import { api, Ingredient } from "@/utils/api";
import { useEffect, useState } from "react";

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (q?: string) => {
    setLoading(true);
    api
      .getIngredients({ page_size: 50, search: q })
      .then((data) => {
        setIngredients(data.ingredients);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message || "加载失败");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">食材大全</h1>
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索食材"
          className="border rounded px-3 py-2 w-full sm:w-64"
          onKeyDown={(e) => {
            if (e.key === "Enter") load(search);
          }}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => load(search)}
        >
          搜索
        </button>
      </div>

      {loading && <p>加载中...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
        {ingredients.map((ing) => (
          <div
            key={ing.id}
            className="bg-white dark:bg-gray-800 rounded shadow-sm p-4 flex flex-col gap-1"
          >
            <span className="font-medium line-clamp-2">{ing.name}</span>
            {ing.energy_kcal != null && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(ing.energy_kcal)} kcal / 100g
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 