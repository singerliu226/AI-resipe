import axios from "axios";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { Parser } from "json2csv";
import logger from "@smart-recipe/logger";

/**
 * 简化的营养成分记录格式
 */
interface NutritionRecord {
  id: string; // 使用顺序号或原始编码
  name: string; // 中文名称
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
}

const DEFAULT_DOWNLOAD_URL =
  "https://raw.githubusercontent.com/foodnutritionfacts/chinese-food-composition/6th/CFCT_6th_2018.xlsx"; // 如需其他版本请替换

/**
 * 下载 Excel 文件到临时目录，返回文件路径
 */
async function downloadExcel(url: string, tmpDir: string): Promise<string> {
  logger.info(`开始下载食物成分表: ${url}`);
  const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 30000 });
  const filename = path.join(tmpDir, path.basename(url));
  await fs.writeFile(filename, Buffer.from(res.data));
  return filename;
}

/**
 * 将 Excel 转为 NutritionRecord[]
 */
function parseExcel(xlsxPath: string): NutritionRecord[] {
  logger.info(`解析 Excel: ${xlsxPath}`);
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, any>[];

  const records: NutritionRecord[] = [];

  json.forEach((row: Record<string, any>, idx: number) => {
    // 根据列头名做兼容映射
    const name = (row["食物名称"] || row["食物"] || row["名称"]) as string | undefined;
    if (!name) return;
    const record: NutritionRecord = {
      id: String(row["编码"] ?? idx + 1),
      name: name.trim(),
      energy_kcal: num(row["能量(kcal)"] || row["能量(千卡)"]),
      protein_g: num(row["蛋白质(g)"] || row["蛋白质"]),
      fat_g: num(row["脂肪(g)"] || row["脂肪"]),
      carb_g: num(row["碳水化合物(g)"] || row["碳水化合物"]),
    };
    records.push(record);
  });
  return records;
}

function num(val: any): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/**
 * 保存为 CSV
 */
async function saveCsv(records: NutritionRecord[], outPath: string): Promise<void> {
  const parser = new Parser({ fields: Object.keys(records[0]) });
  const csv = parser.parse(records);
  await fs.writeFile(outPath, csv, "utf-8");
}

async function main() {
  const tmpDir = path.resolve(".tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const url = process.env.NUTRITION_XLS_URL || DEFAULT_DOWNLOAD_URL;
  const excelPath = await downloadExcel(url, tmpDir);
  const records = parseExcel(excelPath);

  if (records.length === 0) {
    logger.error("Excel 解析后没有任何记录，可能列名不匹配。请检查文件格式。");
    process.exit(1);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outCsv = path.resolve(__dirname, "../../../apps/api/data/nutrition_cn.csv");
  await saveCsv(records, outCsv);
  logger.info(`✅ 完成转换，共 ${records.length} 条，输出 CSV: ${outCsv}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /* eslint-disable @typescript-eslint/no-floating-promises */
  main().catch((e) => {
    logger.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
  /* eslint-enable */
} 