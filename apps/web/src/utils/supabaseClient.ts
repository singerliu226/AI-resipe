import { createClient } from "@supabase/supabase-js";

/**
 * 创建浏览器端 Supabase 客户端实例。
 * 
 * @remarks
 * - 使用 `NEXT_PUBLIC_` 前缀读取公开环境变量，确保仅含匿名访问密钥。
 * - 该模块在浏览器与 React 组件中共享单例，避免重复创建连接。
 * - 使用惰性初始化，只有在实际使用时才创建客户端，避免构建时错误。
 */

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  // 构建时不创建真实的客户端，避免构建失败
  if (typeof window === 'undefined') {
    // 构建时返回一个空的代理对象
    const mockClient = new Proxy({}, {
      get() {
        return () => Promise.resolve({});
      }
    }) as ReturnType<typeof createClient>;
    supabaseInstance = mockClient;
    return mockClient;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // 浏览器环境缺少配置时，返回空实现并告警，避免崩溃
    if (typeof window !== 'undefined') {
      console.error('Missing Supabase environment variables, using mock client');
      const mockClient = new Proxy({}, {
        get() {
          return () => Promise.resolve({});
        }
      }) as ReturnType<typeof createClient>;
      supabaseInstance = mockClient;
      return mockClient;
    }
    throw new Error('Missing Supabase environment variables');
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// 创建一个代理对象，保持原有的使用方式
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  }
}); 