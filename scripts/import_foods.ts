import { promises as fs } from "fs";
import path from "path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore  缺少类型定义
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

interface CsvRow {
  id: string;
  name: string;
  energy_kcal: string;
  protein_g: string;
  fat_g: string;
  carb_g: string;
  fiber_g: string;
  calcium_mg: string;
  sodium_mg: string;
}

function toNumber(val: string): number | null {
  if (!val) return null;
  const num = parseFloat(val);
  return Number.isNaN(num) ? null : num;
}

async function main() {
  const prisma = new PrismaClient();
  const csvPath = path.resolve(process.cwd(), "apps/api/data/nutrition_cn.csv");
  const raw = await fs.readFile(csvPath, "utf-8");
  const records: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`🚀 读取到 ${records.length} 条食材记录，开始写入数据库...`);

  for (const row of records) {
    await (prisma.ingredient as any).upsert({
      where: { name: row.name.trim() },
      update: {
        energyKcal: toNumber(row.energy_kcal),
        proteinG: toNumber(row.protein_g),
        fatG: toNumber(row.fat_g),
        carbG: toNumber(row.carb_g),
        fiberG: toNumber(row.fiber_g),
        calciumMg: toNumber(row.calcium_mg),
        sodiumMg: toNumber(row.sodium_mg),
      },
      create: {
        name: row.name.trim(),
        energyKcal: toNumber(row.energy_kcal),
        proteinG: toNumber(row.protein_g),
        fatG: toNumber(row.fat_g),
        carbG: toNumber(row.carb_g),
        fiberG: toNumber(row.fiber_g),
        calciumMg: toNumber(row.calcium_mg),
        sodiumMg: toNumber(row.sodium_mg),
      },
    } as any);
  }

  await prisma.$disconnect();
  console.log("✅ 食材营养数据导入完成！");
}

/* eslint-disable @typescript-eslint/no-floating-promises */
main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 