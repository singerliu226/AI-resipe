# 智能食谱 Demo PRD v1.1

> 本文档基于早期版本进行完善，结合评审意见及通用改进方向，确定以 **方案 1 – Next.js + Supabase** 为首版 Demo 的实现方案。

---

## 1. 项目概述
智能食谱致力于为用户提供个性化、科学、可持续的饮食推荐。首版 Demo 将以 Web 形态上线，用于快速收集真实用户数据与反馈，为后续 App / 小程序迭代奠定基础。

### 1.1 目标
1. **MVP 上线**：8–10 个开发日内完成并部署可用 Demo。
2. **数据闭环**：收集不少于 100 份用户画像问卷与 50 条菜谱反馈。
3. **体验指标**：推荐成功率 ≥ 90%，平均页面加载 ≤ 1.5 s。

### 1.2 核心 KPI
| 指标 | 定义 | 目标 |
| --- | --- | --- |
| DAU | 日活用户数 | 200 |
| 问卷完成率 | 完成问卷 / 进入问卷页 | ≥ 60% |
| 菜谱点击率 | 查看任意推荐菜谱次数 / 推荐展示次数 | ≥ 50% |
| 反馈提交率 | 提交满意度 / 进入菜谱页 | ≥ 25% |

---

## 2. 用户故事 & 流程
| 编号 | 用户故事 | 验收标准 |
| --- | --- | --- |
| US-01 | 作为新用户，我想通过邮箱登录，确保数据能同步 | 成功收取验证码、完成登录并跳转到问卷页 |
| US-02 | 作为用户，我想填写个人身体参数，得到每日基础代谢 | 保存成功后展示 BMR 结果 |
| US-03 | 作为用户，我想选择增肌/减脂/维持等目标 | 保存目标后进入偏好设置页 |
| US-04 | 作为用户，我想标记忌口与风味偏好，避免出现不喜欢的食材 | 推荐列表中不出现黑名单食材 |
| US-05 | 作为用户，我想看到今日三餐的菜谱推荐及营养分布 | 页面展示三餐卡片，含热量 & 三大宏营养素占比 |
| US-06 | 作为用户，我想对推荐结果进行满意度反馈，以帮助系统改进 | 提交反馈后出现成功提示 |

> **用户流程**：登录 → 问卷（身体参数 → 健康目标 → 饮食偏好）→ 生成推荐 → 查看菜谱详情 → 满意度反馈。

非功能需求：
* 页面加载 ≤ 1.5 s（P95）
* 数据加密传输（HTTPS）
* 移动端兼容（≥ 375 px 宽度）

---

## 3. 功能模块
### 3.1 账号与权限
* 邮箱验证码登录（Supabase Auth）。
* 用户表存储基础信息（id、email、created_at、role）。

### 3.2 用户画像分析
| 子功能 | 说明 | 数据字段 |
| --- | --- | --- |
| 代谢计算 | 采用 **Mifflin-St Jeor** 公式：<br/>男：BMR = 10·W + 6.25·H – 5·A + 5<br/>女：BMR = 10·W + 6.25·H – 5·A – 161 | sex, weight, height, age |
| 活动量修正 | PAL 系数：久坐 1.2 / 轻体力 1.375 / 中体力 1.55 / 重体力 1.725 / 运动员 1.9 | activity_level |
| 健康目标 | 增肌 (+15% 热量)、减脂 (–20%)、维持 (±0) | goal |

### 3.3 饮食偏好系统
* **饮食限制**：宗教 / 地域 / 素食等枚举，支持多选。
* **生活方式**：早起 / 夜猫 / 三班倒等，影响餐次时间提示。
* **风味偏好**：
  * 菜系矩阵（川 / 粤 / 湘 / 浙 / …），0–5 喜好度。
  * 味觉图谱（酸/甜/苦/辣/咸/鲜），滑块 0–100。
* **食材黑名单**：多选食材，必不出现。

### 3.4 智能推荐引擎（MVP）
1. **数据源**：
   * 中国食物成分表 6 th & USDA FoodData Central（离线缓存）。
   * 300 道手工标注菜谱（菜谱表）。
2. **热量分配**：早餐 30% / 午餐 40% / 晚餐 30%。
3. **算法流程**：
   1) 根据用户总热量 & 三餐比例，筛选菜谱集合。
   2) 排除黑名单 & 不满足饮食限制项。
   3) 计算与味觉/菜系偏好余弦相似度，取 Top N。
4. **输出**：
   ```json
   {
     "meal": "breakfast",
     "recipes": [
       { "id": 101, "name": "鸡胸肉三明治", "calories": 350, "macro": { "pro": 30, "fat": 8, "carb": 35 } }
     ]
   }
   ```

### 3.5 反馈收集
* 菜谱页五星评分 + 文本意见。
* Supabase `feedback` 表持久化。

### 3.6 管理后台（可选，V2）
* 菜谱 CRUD、数据看板。

---

## 4. 技术方案 – Next.js 14 + Supabase
### 4.1 技术栈
| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js 14 (App Router)、React 18、TypeScript、shadcn/ui、TailwindCSS |
| 鉴权 | Supabase Auth |
| 数据库 | Supabase Postgres + Prisma ORM |
| 后端 API | Next.js API Route / Server Action |
| 日志 | Winston（自建模块，输出至 Supabase KV / File） |
| 算法服务 | Python 3.11 + **DsPy**（大模型提示优化、推荐算法实验） |
| 部署 | Vercel （Preview & Prod 环境） |

### 4.2 系统架构（逻辑视图）
```
User ─╴HTTP(S)╶─▶ Vercel Edge (Next.js)
                     │
                     ├─► Server Action ─╴RPC╶─▶ Supabase Postgres
                     │
                     └─► Supabase Storage (图片/文件)
```

### 4.3 数据库 ER（核心表）
* `users`
* `profiles` (1-1)
* `recipes`
* `ingredients`
* `feedback`

### 4.4 算法服务与 DsPy 集成
* **服务形态**：独立 Python 微服务，采用 FastAPI，部署至 Vercel Serverless Function。
* **核心职责**：
  1. 调用 DsPy 进行 Prompt Tuning / Retrieval Augmented Generation，优化推荐解释文本。
  2. 支持对推荐规则进行参数搜索（如热量权重、味觉相似度阈值）。
* **依赖**：OpenAI / Qwen 等 LLM API、pandas、numpy。
* **版本控制**：与主仓库 monorepo 管理，使用 `pip-tools` 锁定依赖。

---

## 5. 里程碑与时间表（8 工作日）
| Day | 任务 | 产出 |
| --- | --- | --- |
| 1 | 环境初始化、设计系统选型、CI/CD | 项目仓库、Vercel Preview URL |
| 2 | Supabase 架构 & ER 建模 | 数据库迁移脚本 |
| 3 | Auth & 问卷 – 身体参数 | 问卷页面（step 1）上线 |
| 4 | 问卷 – 目标 & 偏好 | 问卷功能完成，写入 DB |
| 5 | 推荐引擎 MVP 实现 | API `/api/recommend` 返回三餐数据 |
| 6 | 菜谱详情页 & 反馈 | 菜谱页可评分 |
| 7 | UI 优化、日志埋点、性能调优 | Lighthouse ≥ 90 |
| 8 | 上线正式环境、灰度测试、收集首批反馈 | Demo URL + 数据监控面板 |

---

## 6. 风险与应对
| 风险 | 影响 | 应对措施 |
| --- | --- | --- |
| 菜谱数据不足 | 推荐重复、用户流失 | 先人工扩充到 300 道，开放 UGC 上传（V2） |
| 算法效果不佳 | 推荐不精准 | 引入 A/B Test，迭代余弦相似度权重 |
| Supabase 宕机 | 服务不可用 | 启用备份 Region，支持导出迁移自托管 |
| 隐私合规 | 法规风险 | 明确隐私政策，提供账号注销 & 数据删除接口 |

---

## 7. 合规与隐私
* **数据最小化**：仅收集完成推荐所需字段。
* **用户协议 & 隐私政策**：首次登录强制确认。
* **加密**：TLS 1.2+，密码哈希 Bcrypt。
* **免责声明**：菜谱建议仅供参考，不能替代专业营养师意见。

---

## 8. 术语表
| 术语 | 解释 |
| --- | --- |
| BMR | Basal Metabolic Rate，基础代谢率 |
| PAL | Physical Activity Level，活动水平系数 |
| MVP | Minimum Viable Product，最小可行产品 |

---

## 9. 开发流程 & Code Review
1. **分支策略**：`main`（受保护） / `develop` / `feature/*`。
2. **Pull Request 模板**：需包含功能描述、测试用例、风险点、截图。
3. **自动检查（CI）**：
   * ESLint + Prettier + TypeScript `strict`。
   * `pnpm test` 单元测试覆盖 ≥ 80%。
   * `pnpm build` 保证可编译。
4. **人工 Code Review**：
   * 每个模块合并前，至少 1 名 Reviewer 通过；重点关注安全、性能、可读性。
   * 使用 GitHub Review Checklist（已附录）。
5. **防停滞机制**：PR 超过 24h 无人处理时发送 Slack 通知。
6. **回顾会议**：周五 30 min，总结本周问题并更新最佳实践。

### 9.1 LLM 预审（自动 Code Review）
* **触发时机**：每当提交 PR 时由 GitHub Actions 拉起。
* **实现方案**：
  1. Action 拉取 PR Diff + 关键文档（`prd.md`、`docs/ARCHITECTURE.md`、`docs/CODING_STYLE.md`）。
  2. 使用 `openai-codereviewer`（或自研脚本）将上下文与 Diff 拼接，调用 GPT-4 / Qwen-Max 生成初步 Review Comment。
  3. 将 LLM 生成的建议以 Review 形式直接回帖。
  4. 人工 Reviewer 基于 LLM 建议做二次审阅。
* **上下文控制**：脚本优先摘要大文件，仅保留与本次变更相关段落，确保 Token < 16k。
* **安全限制**：脱敏环境变量，禁止 LLM 存储任何敏感连接串。

---

## 10. 沟通记录与知识库
**目标**：避免长链路开发过程中上下文丢失，方便新成员快速同步。

1. **Conversation Logger**：
   * 在 Cursor 扩展中启用 `cursor.conversation.saveToFile` 选项；或自建 VS Code 插件 `chat-transcript`，将每轮对话 JSON 追加至 `.cursor_history/history-<date>.jsonl`。
   * 每日自动推送到 Supabase Storage 备份，保留 30 天版本。
2. **知识库向量化**：
   * 使用 `LangChain + pgvector` 将 PRD、架构文档、对话历史切分后写入 `knowledge` 数据表。
   * DsPy 在生成推荐解释或 LLM Review 时可检索相关片段，提升上下文精准度。
3. **可视化检索**：开发简单前端 `/knowledge` 页面，支持全文与向量混合搜索历史对话。
4. **权限控制**：对话历史仅限项目成员访问，采用 Supabase RLS（Row Level Security）。

> 如需调整，请在每日报告中记录风险与进度，确保 8 日内高质量上线。

## 11. 推进计划与任务清单

| 优先级 | 任务 ID | 描述 | 负责人 | 预估工时 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| P0 | task_supabase_auth | 集成 Supabase 邮箱验证码登录、创建 `profiles` 表同步写入 | FE | 0.5 d | monorepo, schema |
| P0 | task_questionnaire_ui | 实现三步问卷（身体指标→健康目标→饮食偏好），保存至 DB | FE | 1 d | task_supabase_auth |
| P0 | task_data_import | 导入《中国食物成分表 v6》和 300 道菜谱种子数据 | BE | 0.5 d | schema |
| P0 | task_recommend_engine | `/api/recommend`：按总热量 & 偏好匹配三餐菜谱 | BE | 1 d | task_data_import |
| P0 | task_recipe_card_ui | 前端展示三餐卡片及菜谱详情页，含营养 & 图片 | FE | 1 d | task_recommend_engine |
| P1 | task_feedback | 五星评分 + 文本反馈，写入 `feedback` 表 | FE | 0.5 d | task_recipe_card_ui |
| P1 | task_performance_optimization | 日志埋点、Lighthouse ≥90、Vercel Edge Cache | 全栈 | 0.5 d | ALL P0 |
| P1 | task_admin_dashboard | 简易管理后台（菜谱 CRUD、反馈统计） | FE | 1 d | task_feedback |

> 说明：
> * **P0**：本周期（MVP）必须完成；**P1**：可与 P0 并行，但上线前需收尾。
> * 预估工时基于 8 h 人日；如遇阻碍，需在晨会更新。
> * 所有任务完成后执行 `task_readme` 更新文档，并在 Vercel 生产环境灰度发布。

      
    


