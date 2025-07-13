/**
 * 通用 API 客户端封装
 * -------------------------------------------------------------
 * 实现原因：
 *  前端页面直接使用 fetch 容易导致如下问题：
 *   1. 重复拼接 API Base URL 以及统一的请求头配置；
 *   2. 错误处理分散，容易出现未捕获异常；
 *   3. 接口类型不统一，缺少良好的 IDE 自动补全支持；
 *
 * 具体实现方式：
 *   1. 提供底层 `request` 方法：包装原生 fetch，统一 BaseURL、超时与错误处理；
 *   2. 提供 常用资源（ingredients / recipes / recommend）对应方法；
 *   3. 通过 TypeScript 泛型约束响应数据类型，减少类型断言；
 *
 * 使用示例：
 * ```ts
 * import { api } from "@/utils/api";
 * const list = await api.getIngredients({ page: 1 });
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import qs from "querystring";

// ---------------- 通用类型 ----------------
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// ---------------- 资源类型 ----------------
export interface Ingredient {
  id: number;
  name: string;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
}

export interface IngredientList {
  ingredients: Ingredient[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RecommendRequest {
  daily_calories: number;
  macro_pro: number;
  macro_fat: number;
  macro_carb: number;
  taste_tags: string[];
}

export interface MealRecipe {
  meal: "breakfast" | "lunch" | "dinner";
  recipe_id: number;
  recipe_name: string;
  calories: number;
}

export interface RecommendResponse {
  breakfast: MealRecipe;
  lunch: MealRecipe;
  dinner: MealRecipe;
}

export interface RecipeIngredient {
  ingredient: Ingredient;
  quantity: number; // 数量，单位由后端返回
}

export interface Recipe {
  id: number;
  name: string;
  calories: number | null;
  macro_pro: number | null;
  macro_fat: number | null;
  macro_carb: number | null;
  cuisine?: string | null;
  ingredients: RecipeIngredient[];
}

// ---------------- 核心请求封装 ----------------

/** 默认请求超时时间 (毫秒) */
const DEFAULT_TIMEOUT = 10_000;

/** 解析 API Base URL，优先运行时 env，其次编译时 */
function getApiBaseUrl(): string {
  // NEXT_PUBLIC_API_BASE_URL 可在 .env.local 注入
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  return base.replace(/\/$/, ""); // 移除尾部斜杠
}

/**
 * fetch 包装，统一异常路径
 */
async function request<T = any>(
  path: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: HeadersInit = { ...(rest.headers as any) };
    // 仅在有请求体或非 GET 时默认附加 Content-Type，避免无意义的预检
    const method = (rest.method || "GET").toUpperCase();
    if (method !== "GET" && !("Content-Type" in headers as any)) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      // 尝试解析标准错误响应
      let errMsg = res.statusText;
      try {
        const data = (await res.json()) as { detail?: string; message?: string };
        errMsg = data.detail || data.message || errMsg;
      } catch (_) {
        // ignore json parse error
      }
      const error: ApiError = { message: errMsg, status: res.status };
      throw error;
    }

    // 204 No Content 直接返回 null
    if (res.status === 204) return null as unknown as T;

    return (await res.json()) as T;
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw { message: "请求超时", status: 408 } satisfies ApiError;
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

// ---------------- 业务接口 ----------------

function buildQuery(params: Record<string, any>) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  );
  const query = qs.stringify(filtered);
  return query ? `?${query}` : "";
}

export const api = {
  /** 获取食材列表 */
  async getIngredients(params: {
    page?: number;
    page_size?: number;
    search?: string;
    has_nutrition?: boolean;
  }): Promise<IngredientList> {
    const query = buildQuery(params);
    return request<IngredientList>(`/api/v1/ingredients${query}`);
  },

  /** 获取单个食材 */
  async getIngredient(id: number): Promise<Ingredient> {
    return request<Ingredient>(`/api/v1/ingredients/${id}`);
  },

  /** 推荐三餐菜谱 */
  async recommend(data: RecommendRequest): Promise<RecommendResponse> {
    return request<RecommendResponse>("/api/v1/recommend", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** 获取单个菜谱 */
  async getRecipe(id: number): Promise<Recipe> {
    return request<Recipe>(`/api/v1/recipes/${id}`);
  },

  /** 获取菜谱列表 */
  async getRecipes(params: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<{ recipes: Recipe[]; total: number; page: number; page_size: number; total_pages: number }> {
    const query = buildQuery(params);
    return request(`/api/v1/recipes${query}`);
  },

  /** 提交菜谱评分 */
  async rateRecipe(id: number, stars: number, comment?: string): Promise<void> {
    await request(`/api/v1/recipes/${id}/ratings`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment }),
    });
  },
}; 