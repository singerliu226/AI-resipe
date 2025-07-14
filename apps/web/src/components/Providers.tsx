"use client";

import { PropsWithChildren, useState } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "@/utils/supabaseClient";

const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * 应用级 Provider：注入 Supabase SessionContext，
 * 如未配置 Supabase，则降级为普通渲染。
 */
export default function Providers({ children }: PropsWithChildren) {
  // 若未配置 Supabase，直接返回 children，避免 auth-helpers 报错
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  // 用 useState 确保客户端仅创建一次 Supabase 实例
  const [client] = useState(() => supabase);

  return (
    <SessionContextProvider supabaseClient={client} initialSession={null}>
      {children}
    </SessionContextProvider>
  );
} 