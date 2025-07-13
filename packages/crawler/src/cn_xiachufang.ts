import axios from "axios";
import * as cheerio from "cheerio";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Parser } from "json2csv";
import pLimit from "p-limit";
import logger from "@smart-recipe/logger";
import axiosRetry from "axios-retry";

/**
 * 中文菜谱结构
 */
interface RecipeCN {
  id: string;
  name: string;
  url: string;
  category: string;
  ingredients: string;
  steps: string;
}

const BASE_URL = "https://www.xiachufang.com";

// 在文件顶端 axiosRetry 设置后自动生效
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: any) => {
    return (
      axiosRetry.isNetworkError(error) ||
      axiosRetry.isRetryableError(error) ||
      (error.response?.status ?? 0) >= 500
    );
  },
});

// 并发限制降低到 3，减少触发 503
const CONCURRENCY = 3;
const limit = pLimit(CONCURRENCY); // 保留 limit

// 随机 sleep
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 抓取探索页，返回菜谱详情链接数组
 */
async function crawlExplorePage(page = 1): Promise<string[]> {
  const url = `${BASE_URL}/explore/?page=${page}`;
  logger.debug(`Fetch explore page: ${url}`);
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });
  const html = res.data as string;
  const $ = cheerio.load(html);

  // 使用正则匹配所有 /recipe/\d+/ 链接，避免依赖易变 CSS 选择器
  const linksSet = new Set<string>();
  $('a[href^="/recipe/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && /\/recipe\/\d+/.test(href)) {
      linksSet.add(BASE_URL + href.replace(/#.*$/, ""));
    }
  });

  // 如果传统选择器未找到，fallback 到正则解析整个 HTML
  if (linksSet.size === 0) {
    const regex = /href="(\/recipe\/(\d+)\/?)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      linksSet.add(BASE_URL + match[1]);
    }
  }

  return Array.from(linksSet);
}

/**
 * 解析菜谱详情页
 */
async function parseRecipe(url: string): Promise<RecipeCN | null> {
  try {
    // 随机 200~600ms 延时，降低被封概率
    await sleep(200 + Math.random() * 400);
    const res = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Referer: BASE_URL,
      },
    });
    const $ = cheerio.load(res.data);
    const name = $("h1.page-title").text().trim();
    if (!name) return null;
    const idMatch = url.match(/recipe\/(\d+)/);
    const id = idMatch ? idMatch[1] : name;
    const category = $(".breadcrumb a").eq(1).text().trim();

    const ingredients = $("table.ings tr")
      .map((_, tr) => {
        const ing = $(tr).find("td.name a, td.name").text().trim();
        const amount = $(tr).find("td.unit").text().trim();
        return ing ? `${ing}${amount ? `(${amount})` : ""}` : "";
      })
      .get()
      .filter(Boolean)
      .join("; ");

    const steps = $("div.steps p.text")
      .map((_, p) => $(p).text().trim())
      .get()
      .join(" | ");

    return { id, name, url, category, ingredients, steps };
  } catch (error: any) {
    logger.warn(`parseRecipe failed for ${url}: ${error.message}`);
    return null;
  }
}

export async function crawlChineseRecipes(maxPages = 2): Promise<RecipeCN[]> {
  const recipeUrls: string[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const urls = await crawlExplorePage(page);
    recipeUrls.push(...urls);
  }
  logger.info(`共采集到 ${recipeUrls.length} 条详情链接，开始并发抓取 ...`);

  const tasks = recipeUrls.map((url) => limit(() => parseRecipe(url)));
  const results = await Promise.all(tasks);
  return results.filter(Boolean) as RecipeCN[];
}

export async function saveRecipesCN(recipes: RecipeCN[]): Promise<string> {
  const parser = new Parser({ fields: Object.keys(recipes[0]) });
  const csv = parser.parse(recipes);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const csvPath = path.resolve(__dirname, "../../../apps/api/data/recipes_cn.csv");
  await fs.writeFile(csvPath, csv, "utf-8");
  return csvPath;
}

// 判断是否作为主脚本执行
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  /* eslint-disable @typescript-eslint/no-floating-promises */
  (async () => {
    const start = Date.now();
    const maxPages = process.argv[2] ? Number(process.argv[2]) : 2;
    logger.info(`🚀 开始抓取下厨房菜谱，页数=${maxPages} ...`);
    const recipes = await crawlChineseRecipes(maxPages);
    if (recipes.length === 0) {
      logger.warn("未抓取到任何菜谱");
      process.exit(1);
    }
    const pathSaved = await saveRecipesCN(recipes);
    logger.info(`✅ 完成抓取 ${recipes.length} 条，CSV 已保存至 ${pathSaved}，耗时 ${(Date.now() - start) / 1000}s`);
  })().catch((e) => {
    logger.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
  /* eslint-enable */
} 