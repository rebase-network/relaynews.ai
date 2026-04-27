# Public Site Round 2 Remediation Proposal - 2026-04-27

## 背景

- 输入来源：`docs/PUBLIC_SITE_LOCAL_REVIEW_ROUND2_2026-04-27.md`
- 整改对象：本地公开站点 `http://127.0.0.1:4173/`
- 目标：解决本轮审阅中影响核心浏览、移动端可用性、信息可信度和基础 SEO 资源的问题。

## 整改边界

### 本轮直接整改

- 修复移动端模型榜单详情横向撑宽。
- 降低长模型 key 在移动端的视觉压迫感。
- 强化 Relay 详情页的官网地址、联系方式、健康摘要和模型列表标题。
- 调整首页赞助卡语言，避免复用自然榜单质量背书。
- 压缩 `/probe` 未测试状态结果面板。
- 缩短 `/submit` 移动端首屏标题，提升任务入口效率。
- 更新 sitemap 与 favicon，使静态资源与当前公开路由更一致。
- 补充 Playwright 验收，覆盖移动端无横向溢出、详情摘要、赞助分离、静态资源和关键表单。

### 架构级后续项

- 全站 SSR / pre-render：当前前端仍是 CSR SPA。可以先通过静态 fallback HTML 改善部分路由的初始 HTML，但真正让所有动态榜单与 Relay 详情在 HTTP 首包中携带实时内容，需要 Workers SSR 或构建期快照预渲染。
- 真实 HTTP 404 / 3xx：本地 Vite 和静态资产 fallback 下，客户端能渲染 404/noindex/redirect，但 HTTP 状态仍可能是 200。生产要完全修复，需要 Worker 层或构建产物路由规则参与。
- 动态 sitemap：本轮可把静态 sitemap 修到当前已知公开路由；长期应由 public API 快照或构建脚本生成，避免数据变化后再次过期。

## 问题与整改方案

### 1. 移动端模型榜单详情横向溢出

- 问题：`/leaderboard/:modelKey` 在 390px 视口下被撑到约 756px。
- 方案：约束 leaderboard 页面根容器、模型切换 panel、横向 pill、移动榜单卡片的 `min-width` 和 `max-width`；长模型 key 允许在视觉层安全换行，不撑开根页面。
- 验收：移动端 `document.documentElement.scrollWidth === window.innerWidth`，至少覆盖 `anthropic-claude-sonnet-4.6` 与 `openai-gpt-5.4`。

### 2. 长模型 key 视觉权重过高

- 问题：直接把 canonical `modelKey` 用作主标题和卡片大标题，移动端英文 slug 过重。
- 方案：新增模型展示名 helper。视觉主标题使用“Claude Sonnet 4.6 / GPT 5.4”等展示名，技术 key 保留为小号 mono 文本、title 或辅助说明；URL 和 API 字段保持不变。
- 验收：首页预览、目录页、榜单详情、Relay 模型健康卡均仍能看到原始 key 或可追溯信息，但首屏主标题更易读。

### 3. Relay 详情页信息层级不足

- 问题：详情页顶部公开身份信息应聚焦官网地址与联系方式，Base URL 属于测试和监控字段，不应作为公开详情页身份信息展示；模型健康列表缺少整体摘要和标题。
- 方案：Relay hero meta 只展示官网地址和联系方式；联系信息识别 URL、邮箱、Telegram handle；模型健康 panel 增加“支持模型健康概览”、健康/异常/最近验证/样本覆盖摘要。
- 验收：`/relay/aurora-relay` 不显示 `Base URL` 或 `aurora.relaynew.ai/v1`，可见官网地址、联系方式，模型健康区域有标题和摘要指标。

### 4. 赞助展示仍像自然榜单背书

- 问题：首页赞助卡仍展示“高性价比/健康”等自然榜单徽章语言。
- 方案：赞助卡改为商业展示语言，仅保留“赞助展示”“商业合作位”“不参与评分或排序”“查看站点资料”。若展示监控状态，降权为说明，不作为主视觉。
- 验收：首页赞助区不出现自然质量徽章作为赞助卡主内容，赞助分离说明仍可见。

### 5. 提交页首屏过重

- 问题：移动端 `/submit` H1 过长，表单入口下沉。
- 方案：H1 改为“提交你的 Relay 站点”，原利益说明下放到正文。移动端降低标题字号和 hero padding。
- 验收：移动端首屏更快进入表单，桌面仍保留暖色海报风格。

### 6. Probe 空结果面板占比偏大

- 问题：未测试状态仍渲染完整结果 panel，视觉优先级过高。
- 方案：未测试状态改为轻量提示，减少 min-height 和描述长度；有结果或错误时仍显示完整诊断。
- 验收：`/probe` 移动端表单是主任务，空结果面板不再占据过大首屏空间。

### 7. sitemap 与 favicon 静态资源问题

- 问题：sitemap 包含过期路径并漏掉当前有效路径；`favicon.ico` 是 SVG 内容但按 ICO 暴露。
- 方案：更新 sitemap 到当前公开路由；生成真实 ICO 文件，同时保留 SVG favicon。
- 验收：`/sitemap.xml` 包含当前模型和 Relay 路由；`/favicon.ico` 文件 magic header 为 ICO 而非 `<svg`。

## 优先级

- P0：移动端榜单横向溢出。
- P1：Relay 详情公开联系信息与健康摘要、赞助语言、sitemap、favicon。
- P2：模型展示名、提交页首屏、Probe 空状态、小字号和触控体验。

## 风险与控制

- 不改变 API 合同，不改 ranking 逻辑，不改探测安全策略。
- 模型展示名只影响视觉，不改变 URL、`modelKey`、API 参数和测试逻辑。
- sitemap 静态修复只是阶段性方案，动态生成仍需后续工作。
