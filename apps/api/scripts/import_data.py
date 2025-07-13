#!/usr/bin/env python3
"""
数据导入脚本
================
1. 读取 data/foods.csv, data/recipes.csv
2. 使用 psycopg2 按批写入 Supabase Postgres
3. 连接字符串从环境变量 SUPABASE_DB_URL 读取
4. 支持 --dry-run 与 --truncate 参数

Usage
-----
$ SUPABASE_DB_URL=postgresql://user:pass@host:5432/db \
  python scripts/import_data.py --truncate
"""
import argparse
import csv
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FOOD_CSV = DATA_DIR / "foods.csv"
RECIPE_CSV = DATA_DIR / "recipes.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import seed data into Supabase Postgres")
    parser.add_argument("--dry-run", action="store_true", help="Parse CSV only, do not write DB")
    parser.add_argument("--truncate", action="store_true", help="Truncate target tables before insert")
    return parser.parse_args()


def get_connection():
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[ERROR] 环境变量 SUPABASE_DB_URL 未设置", file=sys.stderr)
        sys.exit(1)
    return psycopg2.connect(db_url)


def load_csv(path: Path):
    if not path.exists():
        print(f"[WARN] {path} not found, skip")
        return []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def truncate_tables(cur):
    cur.execute("TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;")
    cur.execute("TRUNCATE TABLE ingredients RESTART IDENTITY CASCADE;")


def bulk_insert(cur, table: str, rows: list[dict]):
    if not rows:
        return
    cols = rows[0].keys()
    tpl = "(" + ",".join([f"%({c})s" for c in cols]) + ")"
    sql = f"INSERT INTO {table} (" + ",".join(cols) + ") VALUES %s ON CONFLICT DO NOTHING"
    execute_values(cur, sql, rows, template=tpl)


def main():
    args = parse_args()

    foods = load_csv(FOOD_CSV)
    recipes = load_csv(RECIPE_CSV)

    print(f"Loaded {len(foods)} food items, {len(recipes)} recipes")

    if args.dry_run:
        print("--dry-run: stop after parsing CSV")
        return

    conn = get_connection()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            if args.truncate:
                truncate_tables(cur)
                print("Truncated existing tables")

            bulk_insert(cur, "ingredients", foods)
            bulk_insert(cur, "recipes", recipes)
            conn.commit()
            print("Data import completed ✔")
    except Exception as exc:
        conn.rollback()
        print(f"[ERROR] {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main() 