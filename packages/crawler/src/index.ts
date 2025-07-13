import axios from "axios";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Parser } from "json2csv";
import logger from "@smart-recipe/logger";

/**
 * 菜谱数据结构。
 * TheMealDB 返回字段较多，此处仅保留 MVP 阶段需要展示的核心字段，
 * 后续可在 `Recipe` 接口中添加新字段并在 `mapMealToRecipe` 中补充映射逻辑。
 */
interface Recipe {
  id: string;
  name: string;
  category: string;
  area: string;
  instructions: string;
  thumbnail: string;
}

/**
 * 将 TheMealDB 的 meal 对象映射为内部 `Recipe` 对象。
 * @param meal TheMealDB API 返回的单条菜谱
 * @returns 归一化后的菜谱记录
 */
function mapMealToRecipe(meal: any): Recipe {
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory,
    area: meal.strArea,
    instructions: meal.strInstructions.replace(/\r?\n|\r/g, " ").trim(),
    thumbnail: meal.strMealThumb,
  };
}

/**
 * 依次按字母抓取菜谱。
 * TheMealDB 提供 `search.php?f=a` 形式的接口按首字母查询。
 * 26 个字母全部抓取大约 4~6 秒，数据量约 2500 条，满足 MVP 需求。
 */
async function crawlAllRecipes(): Promise<Recipe[]> {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const all: Recipe[] = [];
  for (const letter of alphabet) {
    try {
      const url = `https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`;
      logger.debug(`Fetching meals for letter '${letter}' -> ${url}`);
      const res = await axios.get(url, { timeout: 15_000 });
      if (res.data.meals) {
        const mapped = res.data.meals.map(mapMealToRecipe);
        all.push(...mapped);
        logger.debug(`Fetched ${mapped.length} meals for letter '${letter}'.`);
      }
    } catch (error: any) {
      logger.error(`Error fetching letter '${letter}': ${error.message}`);
    }
  }
  return all;
}

/**
 * 保存为 CSV，供后续 FastAPI 或数据库导入。
 * @param recipes 抓取到的菜谱列表
 */
async function saveAsCsv(recipes: Recipe[]): Promise<string> {
  const parser = new Parser({ fields: Object.keys(recipes[0]) });
  const csv = parser.parse(recipes);

  // 解析到 monorepo 根目录的 data 路径
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const csvPath = path.resolve(__dirname, "../../../apps/api/data/recipes.csv");
  await fs.writeFile(csvPath, csv, { encoding: "utf-8" });
  return csvPath;
}

async function main() {
  const start = Date.now();
  logger.info("🚀 开始抓取菜谱数据 ...");
  const recipes = await crawlAllRecipes();
  logger.info(`✅ 抓取完成，共 ${recipes.length} 条，用时 ${(Date.now() - start) / 1000}s.`);

  if (recipes.length === 0) {
    logger.warn("未抓取到任何菜谱，程序提前结束。");
    return;
  }

  const csvPath = await saveAsCsv(recipes);
  logger.info(`📄 CSV 文件已保存至: ${csvPath}`);
}

// Node 独立运行入口
if (import.meta.url === process.argv[1] || process.argv[1] === fileURLToPath(import.meta.url)) {
  /* eslint-disable @typescript-eslint/no-floating-promises */
  main().catch((e) => {
    logger.error(`Crawler failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
  /* eslint-enable @typescript-eslint/no-floating-promises */
} 