import { createClient } from "@supabase/supabase-js";

/**
 * 创建浏览器端 Supabase 客户端实例。
 * 
 * @remarks
 * - 使用 `NEXT_PUBLIC_` 前缀读取公开环境变量，确保仅含匿名访问密钥。
 * - 该模块在浏览器与 React 组件中共享单例，避免重复创建连接。
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
); 