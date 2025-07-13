"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Stepper from "@/components/Stepper";

export default function QuestionnairePage() {
  const steps = [
    { title: "身体参数" },
    { title: "健康目标" },
    { title: "饮食偏好" },
  ];

  const [current, setCurrent] = useState(0);
  const [form, setForm] = useState({
    sex: "male",
    height: "",
    weight: "",
    age: "",
    activity: "1.2",
    goal: "maintain",
    dislikes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 下一步/提交 */
  const handleNext = async () => {
    if (current < steps.length - 1) {
      setCurrent((c) => c + 1);
      return;
    }

    // 提交到 Supabase profiles
    setLoading(true);
    setError(null);
    const {
      data: { session: activeSession },
      error: sessErr,
    } = await supabase.auth.getSession();

    if (sessErr || !activeSession) {
      setError(sessErr?.message || "登录状态失效，请重新登录");
      setLoading(false);
      return;
    }

    const user = activeSession.user;

    // 简单必填校验
    if (!form.height || !form.weight || !form.age) {
      setError("请完整填写身高、体重、年龄");
      setLoading(false);
      return;
    }

    // 类型转换
    const payload = {
      sex: form.sex,
      height: Number(form.height),
      weight: Number(form.weight),
      age: Number(form.age),
      activity: Number(form.activity),
      goal: form.goal,
      dislikes: form.dislikes,
    };

    const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, ...payload });

    setLoading(false);
    if (dbErr) {
      setError(dbErr.message);
    } else {
      alert("问卷已保存，感谢填写！");
      // 跳转首页或推荐页
      location.href = "/";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <Stepper steps={steps} current={current} />

      {/* 步骤内容 */}
      {current === 0 && (
        <section className="space-y-4">
          <div>
            <label className="block mb-1">性别</label>
            <select name="sex" value={form.sex} onChange={handleChange} className="border p-2 w-full">
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">身高 (cm)</label>
              <input name="height" value={form.height} onChange={handleChange} type="number" className="border p-2 w-full" />
            </div>
            <div>
              <label className="block mb-1">体重 (kg)</label>
              <input name="weight" value={form.weight} onChange={handleChange} type="number" className="border p-2 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">年龄</label>
              <input name="age" value={form.age} onChange={handleChange} type="number" className="border p-2 w-full" />
            </div>
            <div>
              <label className="block mb-1">活动水平 (PAL)</label>
              <select name="activity" value={form.activity} onChange={handleChange} className="border p-2 w-full">
                <option value="1.2">几乎不运动（久坐）</option>
                <option value="1.375">轻度运动≈30 min/天</option>
                <option value="1.55">中等运动≈1 h/天</option>
                <option value="1.725">高强度运动≈2 h/天</option>
                <option value="1.9">专业训练≥3 h/天</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {current === 1 && (
        <section className="space-y-4">
          <label className="block mb-2">目标</label>
          <div className="flex flex-col gap-2">
            {[
              { v: "bulk", l: "增肌 (+15%)" },
              { v: "cut", l: "减脂 (-20%)" },
              { v: "maintain", l: "维持" },
            ].map((g) => (
              <label key={g.v} className="flex items-center gap-2">
                <input type="radio" name="goal" value={g.v} checked={form.goal === g.v} onChange={handleChange} />
                {g.l}
              </label>
            ))}
          </div>
        </section>
      )}

      {current === 2 && (
        <section className="space-y-4">
          <label className="block mb-1">食材黑名单 / 忌口 (逗号分隔)</label>
          <input
            name="dislikes"
            value={form.dislikes}
            onChange={handleChange}
            className="border p-2 w-full"
            placeholder="如: 香菜, 羊肉"
          />
        </section>
      )}

      {error && <p className="text-red-500 mt-4">{error}</p>}

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {current === steps.length - 1 ? (loading ? "提交中..." : "提交") : "下一步"}
        </button>
      </div>
    </main>
  );
} 