# Public Site Local Test Flow - 2026-04-27

## 测试目标

本流程用于验证本轮 UI/UX 与视觉整改是否完成，覆盖静态资源、公开页面、错误态、榜单状态、表单校验、移动端布局和 API 缓存头。

## 前置条件

- 已安装依赖：`pnpm install`
- Docker 可用，供 Playwright 本地 E2E 启动 PostgreSQL 测试容器。
- 本地端口 `54329`、`8787`、`4173`、`4174` 未被占用。
- 不需要生产数据库数据；默认使用 E2E seed 数据验证。

## 自动化命令

基础测试：

- `pnpm test`

完整浏览器测试：

- `pnpm test:e2e`

只跑公开站点相关测试：

- `pnpm test:e2e -- e2e/public.spec.ts`
- `pnpm test:e2e -- e2e/api.spec.ts`

构建验证：

- `pnpm build:web:prod`

## 需要覆盖的内容

### 1. 静态资源与 SEO fallback

- `/robots.txt` 返回文本，不是 HTML。
- `/sitemap.xml` 返回 XML，不是 HTML。
- `/favicon.ico` 返回图标资源，不是 HTML。
- `/` 的 HTML 包含首页核心 fallback 文案。
- 首页、榜单、方法页、提交页、测试页、Relay 详情页有正确 metadata。

### 2. 路由与错误态

- 普通未知路由显示中文 404，不自动跳转。
- 无效模型榜单显示中文错误态，不显示 `Model not found`。
- 无效 Relay 详情显示中文错误态，不显示 `Relay not found`。
- 无效页面设置 `noindex` 或不使用错误 canonical。

### 3. 榜单可信度

- 健康行可以展示正向徽章。
- `down`、`unknown`、0% 可用或低于阈值的行不展示 `低延迟`。
- 不可用行有降权视觉。
- 赞助区不使用自然排名样式。

### 4. Relay 详情

- 7 天趋势条有图例。
- 低样本或无样本有显性说明。
- 联系方式为空或“暂无”时不渲染。
- URL 或邮箱联系方式可点击。
- 移动端状态 badge 不被挤压。

### 5. 表单与测试页

- `/probe` 空提交显示中文字段级错误。
- 首页快速测试空提交显示中文错误。
- API Key 不回显在错误或结果摘要中。
- `/submit` 既有中文校验继续有效。

### 6. 移动端布局

- 首页移动端首屏先展示主标题和 CTA。
- 榜单详情移动端无水平滚动，模型切换有滚动提示。
- Relay 详情移动端卡片信息可读。
- `/probe`、404 等短页面 footer 贴底。
- Footer 外链点击区域足够。

## 线上发布后只读复查

发布后可运行：

- `pnpm test:e2e:deployed`

并人工或 curl 抽查：

- `curl -I https://relaynew.ai/robots.txt`
- `curl -I https://relaynew.ai/sitemap.xml`
- `curl -I https://relaynew.ai/favicon.ico`
- `curl -s https://relaynew.ai/ | rg "发现优质AI服务商"`
- `curl -I https://api.relaynew.ai/public/home-summary`

## 失败处理

- 如果 `pnpm test` 失败，先修 TypeScript、API 或共享 contract 问题。
- 如果 Playwright 失败，优先查看 trace、截图和控制台错误。
- 如果移动端截图失败，先检查是否出现水平滚动或首屏顺序回退。
- 如果部署 smoke 与本地不一致，先确认线上是否已发布当前 commit，再比较 API 快照数据差异。

