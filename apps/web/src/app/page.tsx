import Image from "next/image";
import { api } from "@/utils/api";
import RecipeCard from "@/components/RecipeCard";
import Link from "next/link";

interface HomeData {
  ingredients: Awaited<ReturnType<typeof api.getIngredients>>;
  recommend: Awaited<ReturnType<typeof api.recommend>> | null;
}

async function fetchHomeData(): Promise<HomeData> {
  const [ingredients, recommend] = await Promise.all([
    api.getIngredients({ page_size: 8, has_nutrition: true }),
    (async () => {
      try {
        return await api.recommend({
          daily_calories: 2000,
          macro_pro: 120,
          macro_fat: 60,
          macro_carb: 250,
          taste_tags: [],
        });
      } catch {
        return null;
      }
    })(),
  ]);

  return { ingredients, recommend };
}

export default async function Home() {
  const { ingredients, recommend } = await fetchHomeData();

  return (
    <div className="min-h-screen px-4 sm:px-8 pb-16">
      {/* Hero */}
      <section className="text-center py-12 space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold sm:text-4xl">智能食谱助手</h1>
        <p className="text-gray-600 dark:text-gray-300">
          根据你的营养目标与口味偏好，智能推荐最合适的三餐搭配。
        </p>
        <div className="flex justify-center gap-4 pt-4">
          {/* 使用 Next.js Link 进行客户端导航，避免 ESLint 报错 */}
          <Link
            href="/recipes"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            浏览菜谱
          </Link>
          <Link
            href="/ingredients"
            className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            查找食材
          </Link>
        </div>
      </section>

      {/* 推荐菜谱 */}
      {recommend ? (
        <section className="max-w-5xl mx-auto mb-12">
          <h2 className="text-xl font-semibold mb-4">今日推荐</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {Object.values(recommend).map((meal) => (
              <RecipeCard
                key={meal.meal}
                recipe={{
                  id: meal.recipe_id,
                  name: meal.recipe_name,
                  calories: meal.calories,
                }}
                href={`/recipes/${meal.recipe_id}`}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="max-w-3xl mx-auto mb-12 text-center text-sm text-gray-500 dark:text-gray-400">
          无法加载推荐数据，请稍后再试。
        </section>
      )}

      {/* 食材示例 */}
      {ingredients.ingredients.length > 0 && (
        <section className="max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">常用食材</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {ingredients.ingredients.map((ing) => (
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
        </section>
      )}
    </div>
  );
}
