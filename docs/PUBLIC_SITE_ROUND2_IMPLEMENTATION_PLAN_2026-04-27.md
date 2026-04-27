# Public Site Round 2 Implementation Plan - 2026-04-27

## 执行目标

依照 UI/UX 整改方案和视觉风格整改方案，完成本轮公开站点整改，并让问题可通过自动化测试验证。

## 修改切片

### Slice 1：文档与测试基线

- 新增整改方案文档。
- 新增修改计划文档。
- 新增本地测试流程文档。
- 确认本轮直接实现范围与架构级后续项。

### Slice 2：模型榜单移动端与模型展示名

- 在共享层增加模型展示名 helper。
- 首页榜单预览、目录/详情页模型标题使用展示名，保留原始 key 作为辅助信息。
- 修复 leaderboard switcher、mobile row、panel 容器在 390px 视口下的横向溢出。
- 给移动端模型榜单新增 Playwright 溢出断言。

### Slice 3：Relay 详情页

- Hero 中只展示官网地址和联系方式，不展示 Base URL。
- 联系信息支持 URL、邮箱、Telegram handle 的可点击链接。
- 模型健康区增加标题、说明和摘要指标。
- 模型健康移动卡片长 key 安全换行。
- 补充 Playwright 验证公开详情页不展示 Base URL、摘要标题与移动端无横向溢出。

### Slice 4：首页赞助区

- 去掉赞助卡主视觉中的自然榜单徽章与状态点。
- 使用“赞助展示 / 商业合作位 / 不参与评分或排序 / 查看站点资料”的语言。
- 保留赞助区独立分区和跳转到 Relay 详情页的能力。
- 补充 Playwright 验证赞助区不复用质量徽章。

### Slice 5：提交页与 Probe 页视觉效率

- `/submit` hero 标题改短，正文承接收录和榜单价值。
- 移动端降低 submit hero 标题字号和 panel 高度。
- `/probe` 未测试状态改为轻量结果提示。
- 补充或更新现有移动端测试断言。

### Slice 6：静态资源与基础 SEO

- 更新 `sitemap.xml`，覆盖当前公开模型榜单与 Relay 详情路径。
- 生成真实 `favicon.ico`，保留 `favicon.svg`。
- 可选生成静态 fallback HTML 的 route metadata，作为 SSR/pre-render 前的过渡；完整 SSR 留作后续架构项。
- 补充静态资源测试。

### Slice 7：全自动测试与提交

- 运行单元/类型测试。
- 运行 Playwright e2e。
- 运行生产构建。
- 修复测试发现的问题。
- 提交独立 Conventional Commit。

## 文件范围

- `apps/web/src/shared-base.tsx`
- `apps/web/src/shared/cards.tsx`
- `apps/web/src/pages/leaderboard-page.tsx`
- `apps/web/src/pages/home-page.tsx`
- `apps/web/src/features/relay/relay-hero-section.tsx`
- `apps/web/src/features/relay/relay-model-health-section.tsx`
- `apps/web/src/features/submit/submit-hero.tsx`
- `apps/web/src/features/probe/probe-result-panel.tsx`
- `apps/web/src/styles.css`
- `apps/web/public/sitemap.xml`
- `apps/web/public/favicon.ico`
- `e2e/public.spec.ts`
- `e2e/static-assets.spec.ts`
- `docs/*.md`

## 非目标

- 不修改 ranking 算法。
- 不修改 public API 合同。
- 不修改数据库结构。
- 不部署线上站点。
- 不引入 Next.js、KV、R2、Redis 或新服务。

## 预期验收

- 移动端核心页面无横向滚动。
- Relay 详情页能解释测试 endpoint 和整体模型健康。
- 赞助与自然排名在文案和视觉上进一步分离。
- 静态 sitemap 与 favicon 基础可用。
- Playwright 自动化覆盖新增关键风险。
