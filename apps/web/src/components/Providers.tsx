"use client";

import { PropsWithChildren, useState } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "@/utils/supabaseClient";

/**
 * 应用级 Provider：注入 Supabase SessionContext，
 * 便于后续任意组件通过 `useSession`、`useSupabaseClient` 获取会话。
 */
export default function Providers({ children }: PropsWithChildren) {
  // 用 useState 确保客户端仅创建一次 Supabase 实例
  const [client] = useState(() => supabase);

  return (
    <SessionContextProvider supabaseClient={client} initialSession={null}>
      {children}
    </SessionContextProvider>
  );
} 