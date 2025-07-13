"use client";

import React from "react";

export interface Step {
  title: string;
}

interface StepperProps {
  steps: Step[];
  current: number; // 当前步骤索引
}

/**
 * 简易水平 Stepper，用于展示步骤进度。
 * - 当前步骤高亮
 * - 已完成步骤显示绿色对勾
 * - 待完成步骤灰色
 */
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex w-full justify-between mb-8">
      {steps.map((step, idx) => {
        const state = idx < current ? "done" : idx === current ? "current" : "todo";
        const base =
          "flex-1 flex flex-col items-center text-sm after:flex-1 after:border-t after:mt-2 last:after:hidden";
        return (
          <li key={idx} className={base + (state === "done" ? " text-green-600" : state === "current" ? " font-semibold" : " text-gray-400")}
          >
            <span className="flex items-center gap-2">
              {state === "done" ? (
                <span className="inline-block w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">✓</span>
              ) : (
                <span
                  className={`inline-block w-4 h-4 rounded-full border ${state === "current" ? "border-blue-600" : "border-gray-300"}`}
                ></span>
              )}
              {step.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
} 