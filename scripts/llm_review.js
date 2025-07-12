#!/usr/bin/env node
/**
 * LLM 预审脚本占位
 * 后续可接入 openai-codereviewer 或自研逻辑。
 * 当前实现：读取 PR diff 路径（由 CI 自动注入），输出占位评论。
 */

const fs = require("fs");

(async () => {
  const diffPath = process.env.GITHUB_EVENT_PATH || "";
  console.log("🧠 LLM Review placeholder running");
  console.log("Diff path:", diffPath);
  // TODO: 调用 OpenAI / DeepSeek API 生成真实评论
  // 目前只模拟输出
  console.log("LLM 评论: ✅ 代码规范检查通过，建议补充单元测试。");
})(); 