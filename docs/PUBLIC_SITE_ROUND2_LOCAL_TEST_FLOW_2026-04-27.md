# Public Site Round 2 Local Test Flow - 2026-04-27

## 测试目标

验证本轮整改后的公开站点在本地环境中满足核心 UI/UX、视觉、功能和静态资源要求。

## 环境前提

- API：`http://127.0.0.1:8787`
- Web：`http://127.0.0.1:4173`
- Admin：`http://127.0.0.1:4174`
- 数据：使用本地 seed 或从线上导入后的公开快照数据。

## 自动化测试命令

1. `pnpm test`
2. `pnpm test:e2e`
3. `pnpm build:web:prod`

## Playwright 覆盖要求

### 页面覆盖

- `/`
- `/leaderboard`
- `/leaderboard/anthropic-claude-sonnet-4.6`
- `/leaderboard/openai-gpt-5.4`
- `/relay/aurora-relay`
- `/methodology`
- `/submit`
- `/probe`
- `/not-a-real-page`
- `/leaderboard/not-a-real-model`
- `/relay/not-a-real-relay`
- `/robots.txt`
- `/sitemap.xml`
- `/favicon.ico`

### 功能断言

- 首页可展示模型榜单预览和独立赞助展示。
- 模型榜单不接受赞助调位，榜单中不混入赞助方。
- Relay 详情只展示官网地址、联系方式、模型健康摘要和 7 天状态，不展示 Base URL。
- `/submit` 空表单显示中文校验。
- `/probe` 空表单显示中文校验；dummy 测试不回显 API Key。
- 404 与无效动态路由保持中文错误状态和 `noindex`。

### 视觉与移动端断言

- 390px 视口下 `/leaderboard/:modelKey` 不产生根页面横向滚动。
- 390px 视口下 `/relay/:slug` 不产生根页面横向滚动。
- 移动端模型标题可读，不以长 slug 作为唯一主视觉。
- `/submit` 移动端 hero 标题更短，表单入口在合理滚动距离内。
- `/probe` 未测试状态结果面板保持轻量。
- 移动端导航链接可点击，触控目标不低于 44px。

### 静态资源断言

- `/robots.txt` 不是 HTML fallback。
- `/sitemap.xml` 不是 HTML fallback，且包含当前公开模型与 Relay 路由。
- `/favicon.ico` 不是 HTML fallback，且文件头不是 SVG 文本。

## 手动抽查建议

自动化通过后，建议人工验收时重点看：

- 首页首屏主次关系是否清晰。
- 榜单详情移动端横向滚动是否完全消失。
- Relay 详情页是否能快速回答“这个站点的公开官网/联系方式是什么、支持多少模型、当前有没有异常”。
- 赞助展示是否不会被误读为自然排名结果。
- 提交和测试页面是否更像任务型工具页面。

## 本轮不强制验证

- 生产 Cloudflare Workers Static Assets 的真实 HTTP 404/3xx。
- 全站 SSR 或动态 pre-render 的实时 HTML 内容。
- `/submit` 成功写入路径，除非测试环境允许产生提交记录。
