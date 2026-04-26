# Public Site Implementation Plan - 2026-04-27

## 输入文档

- `docs/PUBLIC_SITE_PRODUCTION_REVIEW_2026-04-27.md`
- `docs/PUBLIC_SITE_REMEDIATION_PLAN_2026-04-27.md`
- `docs/PUBLIC_SITE_VISUAL_STYLE_REVIEW_2026-04-27.md`
- `docs/PUBLIC_SITE_VISUAL_REMEDIATION_PLAN_2026-04-27.md`

## 实施目标

本轮将 UI/UX 整改和视觉风格整改合并为一个可验证的开发计划，重点完成：

- 静态资源、基础 SEO fallback 和错误态修复。
- 榜单徽章、不可用行和健康样本解释修复。
- `/probe` 与首页快速测试中文校验。
- 移动端首页、榜单、Relay 详情、footer 布局优化。
- Relay 联系方式可操作化。
- 赞助区视觉分离增强。
- 自动化测试覆盖上述关键行为。

## 代码修改范围

### Web

- `apps/web/index.html`
- `apps/web/public/*`
- `apps/web/src/shared-base.tsx`
- `apps/web/src/shared/layout.tsx`
- `apps/web/src/shared/forms-ui.tsx`
- `apps/web/src/shared/cards.tsx`
- `apps/web/src/pages/home-page.tsx`
- `apps/web/src/pages/leaderboard-page.tsx`
- `apps/web/src/pages/not-found-page.tsx`
- `apps/web/src/pages/relay-page.tsx`
- `apps/web/src/features/probe/probe-form-panel.tsx`
- `apps/web/src/features/relay/relay-hero-section.tsx`
- `apps/web/src/features/relay/relay-model-health-section.tsx`
- `apps/web/src/styles.css`

### API

- `apps/api/src/lib/refresh-public-data.ts`
- 如现有公共 API 缓存头已存在，只补测试或保持现状。

### Tests

- `e2e/public.spec.ts`
- `e2e/api.spec.ts`
- 如需要，新增静态资源相关 E2E spec。

## 实施顺序

1. 新增静态资源和 HTML fallback。
2. 改 404、无效模型、无效 Relay 的用户态和 metadata。
3. 改榜单徽章计算、不可用行视觉和样本解释。
4. 改 `/probe` 与首页快速测试中文校验。
5. 改移动端首页顺序、模型切换、Relay 模型卡和 footer。
6. 改 Relay 联系方式和赞助区视觉分离。
7. 更新自动化测试。
8. 运行本地全自动测试，修复回归。

## 验收标准

- `/robots.txt`、`/sitemap.xml`、`/favicon.ico` 不返回 SPA HTML。
- 首页 HTML 有可被 `curl` 读取的核心 fallback 文案。
- 404 和动态详情错误态为中文、稳定、可操作。
- 不可用 Relay 不展示正向 `低延迟` 徽章。
- 7 天趋势条说明无样本和样本覆盖。
- `/probe` 空提交不出现英文浏览器校验。
- 移动端首页先展示产品定位，再展示快速测试。
- Footer 在短页面贴底，图标触摸区足够。
- 赞助区与自然榜单视觉分离。
- `pnpm test` 与相关 Playwright 测试通过。

## 风险控制

- `apps/web/src/styles.css` 是高耦合文件，样式调整以局部 class 为主，避免全局 token 大幅改动。
- 不清理大量既有未使用导入，避免制造噪音 diff。
- 不从生产导入数据库，除非本地 seeded 数据无法覆盖验证场景。
- 不执行部署脚本。

