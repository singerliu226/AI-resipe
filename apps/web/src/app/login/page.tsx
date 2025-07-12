"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRouter } from "next/navigation";
// 使用原生 <input>/<button>，后续可替换为 shadcn/ui 组件

/**
 * 登录页 – 支持 Supabase OTP 邮箱验证码登录。
 * @returns JSX.Element
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 发送验证码 */
  const handleSendCode = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/login`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setPhase("code");
    }
  };

  /** 校验验证码并登录 */
  const handleVerifyCode = async () => {
    setLoading(true);
    setError(null);
    const {
      data: { session },
      error,
    } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error || !session) {
      setError(error?.message || "验证码无效，请重试。");
      return;
    }

    // 确保 profiles 表存在对应记录
    await supabase.from("profiles").upsert({ id: session.user.id, email });

    router.push("/questionnaire");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <h1 className="text-2xl font-semibold">登录 / 注册</h1>
      {phase === "email" ? (
        <>
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className="w-64"
          />
          <button onClick={handleSendCode} disabled={loading || !email}>
            {loading ? "发送中..." : "发送验证码"}
          </button>
        </>
      ) : (
        <>
          <input
            placeholder="请输入邮箱中的 6 位验证码"
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
            className="w-64 tracking-widest"
          />
          <button onClick={handleVerifyCode} disabled={loading || code.length < 6}>
            {loading ? "验证中..." : "验证并登录"}
          </button>
        </>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
} 