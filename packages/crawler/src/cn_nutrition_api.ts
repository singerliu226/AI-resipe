import axios from "axios";
import axiosRetry from "axios-retry";
import pLimit from "p-limit";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Parser } from "json2csv";
import logger from "@smart-recipe/logger";

interface NutritionGitRecord {
  foodCode: string;
  foodName: string;
  energyKCal: number | string;
  protein: number | string;
  fat: number | string;
  CHO: number | string;
  dietaryFiber: number | string;
  Ca?: number | string;
  P?: number | string;
  K?: number | string;
  Na?: number | string;
  Mg?: number | string;
  Fe?: number | string;
  Zn?: number | string;
  Se?: number | string;
  Cu?: number | string;
  Mn?: number | string;
}

interface UnifiedRecord {
  id: string;
  name: string;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fiber_g: number | null;
  calcium_mg: number | null;
  sodium_mg: number | null;
}

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

const GITHUB_API =
  "https://api.github.com/repos/Sanotsu/china-food-composition-data/contents/json_data";
const RAW_BASE =
  "https://raw.githubusercontent.com/Sanotsu/china-food-composition-data/main/json_data/";
const CONCURRENCY = 3; // 降低并发，减小被限流/丢包概率
const limit = pLimit(CONCURRENCY);

/**
 * 尝试通过 raw.githubusercontent.com 获取文件，若失败则回退到 GitHub Contents API
 * 这样可规避国内网络对 raw 域名的阻断，以及临时 404 问题。
 */
async function fetchFileContent(fileName: string): Promise<any> {
  const rawUrl = `${RAW_BASE}${encodeURIComponent(fileName)}`;

  // 优先走 raw，无需额外 headers，速度更快
  try {
    const { data } = await axios.get(rawUrl, { timeout: 20000 });
    return data;
  } catch (rawErr: any) {
    logger.debug(`raw 获取失败，尝试 Contents API: ${fileName}`);

    // 使用 GitHub Contents API + Accept: raw 走 api.github.com 域名（通常国内可访问）
    const apiUrl =
      `https://api.github.com/repos/Sanotsu/china-food-composition-data/contents/json_data/${encodeURIComponent(
        fileName
      )}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3.raw",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const { data } = await axios.get(apiUrl, {
      timeout: 20000,
      headers,
    });
    return data;
  }
}

async function listJsonFiles(): Promise<string[]> {
  logger.debug("Fetching file list from GitHub ...");
  const { data } = await axios.get(GITHUB_API, { timeout: 15000 });
  if (!Array.isArray(data)) throw new Error("Unexpected GitHub API response");
  return data
    .filter((item: any) => item.type === "file" && item.name.endsWith(".json"))
    .map((item: any) => item.name as string);
}

function toNumber(val: string | number | undefined): number | null {
  if (val === undefined) return null;
  if (typeof val === "number") return val;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function mapRecord(raw: NutritionGitRecord): UnifiedRecord {
  return {
    id: raw.foodCode,
    name: raw.foodName,
    energy_kcal: toNumber(raw.energyKCal),
    protein_g: toNumber(raw.protein),
    fat_g: toNumber(raw.fat),
    carb_g: toNumber(raw.CHO),
    fiber_g: toNumber(raw.dietaryFiber),
    calcium_mg: toNumber(raw.Ca),
    sodium_mg: toNumber(raw.Na),
  };
}

async function fetchAndParse(fileName: string): Promise<UnifiedRecord[]> {
  const data = await fetchFileContent(fileName);

  if (!Array.isArray(data)) {
    logger.warn(`${fileName} 不是数组格式，已跳过`);
    return [];
  }

  return (data as NutritionGitRecord[]).map(mapRecord);
}

async function crawlNutritionGit(): Promise<UnifiedRecord[]> {
  const files = await listJsonFiles();
  logger.info(`📃 共发现 ${files.length} 个 JSON 片段，开始并发拉取 ...`);
  const all: UnifiedRecord[] = [];
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const records = await fetchAndParse(file);
          all.push(...records);
          logger.debug(`✅ ${file} -> ${records.length} 条`);
        } catch (e: any) {
          const status = e?.response?.status ? ` HTTP ${e.response.status}` : "";
          logger.error(`❌ 拉取 ${file} 失败:${status} ${(e as Error).message}`);
        }
      })
    )
  );
  return all;
}

async function saveCsv(records: UnifiedRecord[]): Promise<string> {
  const fields = Object.keys(records[0]);
  const parser = new Parser({ fields });
  const csv = parser.parse(records);

  const __filename = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(__filename, "../../../../");
  const savePath = path.join(rootDir, "apps/api/data/nutrition_cn.csv");
  await fs.writeFile(savePath, csv, "utf-8");
  return savePath;
}

// 备用数据源：foodwake（约 1643 条，字段为中文）
const FOODWAKE_JSON_URL =
  "https://raw.githubusercontent.com/LuckyHookin/foodwake/main/food-table.json";

/**
 * 将形如 "12.3克" "54千卡" 的中文描述转为数字。
 */
function parseChineseNumber(val: string | number | undefined): number | null {
  if (val === undefined) return null;
  if (typeof val === "number") return val;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

interface FoodwakeItem {
  name: string;
  info: Record<string, string>; // 中文营养键值
}

/**
 * 抓取并解析 foodwake 数据
 */
async function fetchFoodwakeRecords(): Promise<UnifiedRecord[]> {
  try {
    logger.info("尝试从 foodwake 数据集抓取备用营养数据 ...");
    const { data } = await axios.get<FoodwakeItem[]>(FOODWAKE_JSON_URL, {
      timeout: 30000,
    });
    if (!Array.isArray(data)) throw new Error("foodwake 响应不是数组");

    return data.map((item, idx) => {
      const info = item.info || {};
      return {
        id: `fw-${idx}`,
        name: item.name,
        energy_kcal: parseChineseNumber(info["能量"]),
        protein_g: parseChineseNumber(info["蛋白质"]),
        fat_g: parseChineseNumber(info["脂肪"]),
        carb_g: parseChineseNumber(info["碳水化合物"]),
        fiber_g: parseChineseNumber(info["粗纤维"]),
        calcium_mg: parseChineseNumber(info["钙"]),
        sodium_mg: parseChineseNumber(info["钠"]),
      } satisfies UnifiedRecord;
    });
  } catch (err: any) {
    logger.error(`foodwake 数据抓取失败: ${err.message}`);
    return [];
  }
}

export async function crawlNutrition() {
  const start = Date.now();

  // 先尝试主数据源
  let records = await crawlNutritionGit();

  // 若主源获取为空，则尝试 foodwake 备用源
  if (records.length === 0) {
    logger.warn("主数据源抓取为空，切换到 foodwake 备用数据源 ...");
    records = await fetchFoodwakeRecords();
  }

  if (records.length === 0) throw new Error("两个数据源均未获取到营养数据");

  const pathSaved = await saveCsv(records);
  logger.info(
    `🎉 已保存 ${records.length} 条营养数据到 ${pathSaved}，耗时 ${(Date.now() - start) / 1000}s`
  );
}

// 如果直接执行脚本
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  /* eslint-disable @typescript-eslint/no-floating-promises */
  crawlNutrition().catch((e) => {
    logger.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
  /* eslint-enable */
} 