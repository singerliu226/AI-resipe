'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { api, Recipe } from '@/utils/api';
import RatingModal from '@/components/RatingModal';
import RecipeCard from '@/components/RecipeCard';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const recipeId = Number(id);

  const [data, setData] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    let canceled = false;
    api
      .getRecipe(recipeId)
      .then((r) => {
        if (!canceled) setData(r);
      })
      .catch((e: any) => {
        if (!canceled) setError(e.message || '加载失败');
      });
    return () => {
      canceled = true;
    };
  }, [recipeId]);

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-500">{error}</p>
        <button className="text-blue-600 underline" onClick={() => router.back()}>
          返回
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="p-8 text-center">加载中…</p>;
  }

  const totalMacro = (data.macro_pro || 0) + (data.macro_fat || 0) + (data.macro_carb || 0);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <RecipeCard
        recipe={{ id: data.id, name: data.name, calories: data.calories, category: data.cuisine, thumbnail: undefined }}
        className="shadow-none"
      />

      <section className="grid grid-cols-3 gap-4 text-sm">
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-1">热量</p>
          <p className="text-lg font-semibold">{data.calories ? Math.round(data.calories) : '—'} kcal</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-1">宏量营养(P/F/C)</p>
          <p className="text-lg font-semibold">
            {data.macro_pro || 0}/{data.macro_fat || 0}/{data.macro_carb || 0} g
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-1">蛋白质占比</p>
          <p className="text-lg font-semibold">
            {totalMacro ? Math.round(((data.macro_pro || 0) / totalMacro) * 100) : '—'}%
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">食材</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">食材</th>
              <th className="text-right py-1">数量</th>
              <th className="text-right py-1">能量 (kcal)</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredients.map((ri) => (
              <tr key={ri.ingredient.id} className="border-b last:border-0">
                <td className="py-1">{ri.ingredient.name}</td>
                <td className="py-1 text-right">{ri.quantity}</td>
                <td className="py-1 text-right">
                  {ri.ingredient.energy_kcal != null
                    ? Math.round(ri.ingredient.energy_kcal)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setRatingOpen(true)}
          className="px-6 py-2 rounded bg-blue-600 text-white"
        >
          评分此菜谱
        </button>
      </div>

      <RatingModal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        onSubmit={async (stars, comment) => {
          await api.rateRecipe(recipeId, stars, comment);
          alert('感谢评分！');
        }}
      />
    </div>
  );
} 