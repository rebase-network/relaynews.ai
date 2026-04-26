# Public Site Remediation Plan - 2026-04-27

## 背景

- 整改来源：`docs/PUBLIC_SITE_PRODUCTION_REVIEW_2026-04-27.md`
- 整改对象：`https://relaynew.ai/`
- 目标：把线上审阅中发现的问题转成可实施、可验收、可分阶段发布的工程切片。
- 约束：不引入 Next.js、Cloudflare KV、Cloudflare R2、Redis 或微服务拆分；继续基于 Cloudflare Workers Static Assets、React Router v7、公共 API 快照读和聚合读。

## 整改原则

- 优先修复影响用户信任、搜索索引、错误状态和榜单可信度的问题。
- 公开页面默认中文体验完整，错误态和校验态不能泄露英文实现细节。
- 赞助展示继续与自然排名明确分离，不能因为视觉优化混入榜单排序。
- `/probe` 继续遵守安全边界，不默认持久化用户输入的 API Key。
- 所有整改项都要有可浏览器验证的验收标准，测试以 Playwright-first 为主。

## 推荐执行顺序

### P0：发布可信度与可索引性修复

这些问题直接影响站点可信度、SEO、错误路由、榜单解释性和线上稳定性，应优先处理。

#### P0-1. 修复公开站点基础 SEO 与静态资源

对应问题：审阅问题 1、2。

整改方案：

- 为 `/robots.txt`、`/sitemap.xml`、`/favicon.ico`、`apple-touch-icon`、`site.webmanifest` 提供真实静态资源，确保不再命中 SPA fallback。
- `sitemap.xml` 只包含线上真实可访问的规范页面，包括首页、榜单目录、各模型榜单、各 Relay 详情页、方法页、提交页和测试页。
- 公开核心页面增加可被非 JS 环境读取的首屏主体内容。建议分两步做：先用构建期静态快照覆盖 `/`、`/leaderboard`、`/methodology`；再评估对 `/leaderboard/:modelKey` 和 `/relay/:slug` 做预渲染或 Workers SSR。
- 不引入 Next.js。若需要 SSR，应基于现有 Workers runtime 和 React Router 边界评估；若先做预渲染，应使用现有公共 API 快照数据生成静态 HTML。

验收标准：

- `curl -I https://relaynew.ai/robots.txt` 返回 `200` 且 `content-type` 为文本类型，不是 `text/html`。
- `curl -I https://relaynew.ai/sitemap.xml` 返回 `200` 且 `content-type` 为 XML 类型。
- `curl -I https://relaynew.ai/favicon.ico` 返回图标资源类型，不是 SPA HTML。
- `curl -s https://relaynew.ai/` 能看到首页核心 H1 或主文案，而不是只有空 `#root`。
- Playwright metadata smoke 覆盖首页、榜单、模型榜单、Relay 详情和方法页的 `title`、`description`、`canonical`。

#### P0-2. 修复 404 与无效动态路由体验

对应问题：审阅问题 3、4。

整改方案：

- `/leaderboard/:modelKey` 和 `/relay/:slug` 在 API 返回 404 时渲染中文错误页，不再裸露 `Model not found` 或 `Relay not found`。
- 普通未匹配路由渲染稳定的中文 404 页面，不自动跳回首页。
- 404 页面提供明确入口：返回首页、查看全部榜单、提交站点、开始测试。
- 对无效详情页避免输出指向自身的 canonical；无法返回真实 HTTP 404 时，至少设置 `noindex`。
- 如果 Workers 路由层可以识别未匹配路径，应返回 HTTP 404；否则先在客户端错误态解决用户体验和索引风险。

验收标准：

- `/leaderboard/not-a-real-model` 显示中文错误页，有返回榜单入口，不显示英文裸错误。
- `/relay/not-a-real-relay` 显示中文错误页，有提交站点或开始测试入口，不显示英文裸错误。
- `/review-not-found` 不自动跳转，有清晰 H1 和可点击 CTA。
- 无效页面不输出错误 canonical。
- Playwright 覆盖普通 404、无效模型、无效 Relay 三类错误态。

#### P0-3. 修复榜单健康度、徽章和排序可信度

对应问题：审阅问题 5、6、7。

整改方案：

- 统一 `catalogStatus`、`supportStatus`、`healthStatus` 的使用边界，避免把 Relay 生命周期状态、模型支持状态和运行时健康状态混用。
- 当 `healthStatus` 为 `down`、`unknown`，或 24H 可用性低于阈值时，不展示 `低延迟` 徽章。
- 失败请求的快速返回不能作为正向延迟优势展示。可显示诊断延迟，但文案必须标明不可用或失败样本。
- 不可用 Relay 继续可以出现在榜单中，但应沉底展示，或进入“不可用 / 观察中”分区。
- 首页健康聚合、榜单行状态、Relay 详情模型状态使用同一口径。若首页展示 Relay 级别聚合，必须说明模型级别不可用可能不同。
- 7 天可用性改成“已观测样本可用性”或同时显示“样本覆盖：N/7 天”。低样本徽章必须显性展示，不应折叠进 `+1`。
- 7 天趋势条增加图例或 tooltip，明确灰色代表未知或无样本。

验收标准：

- 0% 可用或 `down` 的行不再显示 `低延迟`。
- 不可用行不会以普通健康 Relay 的视觉权重进入排名顶部。
- 首页健康统计与详情页模型健康状态的口径有明确说明，且数字不会互相矛盾。
- Relay 详情页能看出 7 天数据覆盖不足，例如“样本覆盖 1/7 天”。
- Playwright 覆盖 down 行徽章、低样本展示、首页统计文案和 Relay 详情趋势图例。

#### P0-4. 为公共读 API 增加明确缓存策略

对应问题：审阅问题 14。

整改方案：

- 为 `GET /public/*` 内容读接口统一设置缓存头，包括 `Cache-Control` 和 Cloudflare 可识别的 CDN 缓存头。
- 建议策略：浏览器短缓存，CDN 较短 TTL，允许 stale-while-revalidate 和 stale-if-error。
- `/public/probe/check` 和 `/public/submissions` 继续不缓存。
- 缓存策略应写入 API 层公共路由中间件或集中响应工具，避免逐接口遗漏。

验收标准：

- `GET /public/home-summary`、`GET /public/leaderboard-directory`、`GET /public/relay/:slug/overview` 都有明确缓存头。
- `POST /public/probe/check` 没有公共缓存头。
- API 测试覆盖公共读接口和公共写接口的缓存差异。

### P1：关键中文体验与移动端可用性修复

这些问题不会直接破坏榜单可信度，但会明显影响真实用户完成任务。

#### P1-1. 统一 `/probe` 与首页快速测试的中文校验

对应问题：审阅问题 8。

整改方案：

- 用自定义表单校验替代浏览器默认英文气泡。
- Base URL、API Key、模型字段都显示中文字段级错误。
- 提交失败时在结果区域或表单顶部给出中文汇总，并聚焦到第一个错误字段。
- 首页快速测试卡片和 `/probe` 主表单共享同一套校验文案和字段规则。

验收标准：

- 空提交不出现 `Please fill out this field.`。
- 所有必填字段都有中文错误提示。
- 移动端和桌面端错误提示都可见，不被遮挡。
- Playwright 覆盖首页快速测试和 `/probe` 空提交。

#### P1-2. 重排移动端首页首屏信息结构

对应问题：审阅问题 9。

整改方案：

- 移动端首屏先展示品牌主标题、价值说明、核心 CTA 和关键指标。
- 快速测试表单下移到第二屏，或作为“开始测试”入口后的折叠卡片。
- 桌面端可以继续保持当前左右并列结构，只调整移动端布局顺序。

验收标准：

- 移动端打开首页时，首屏先看到产品定位，而不是表单。
- 首屏包含去榜单和开始测试的主入口。
- Playwright mobile screenshot 覆盖首页首屏。

#### P1-3. 修复移动端标题、模型切换和 Relay 详情拥挤问题

对应问题：审阅问题 10、11、12。

整改方案：

- 为移动端 H1 设置独立字号、行高和最大宽度，避免中文标题被切成不自然短行。
- 模型 key 使用更紧凑的 chip 或 code label，允许在安全断点换行。
- 榜单详情页“切换模型”改为更明确的横向 chips，加左右渐隐遮罩；或改为移动端 select / bottom sheet。
- Relay 详情页移动端把状态 badge 放到模型名下方左侧，使用“健康 · 可用”“不可用 · 降级”等单行表达。

验收标准：

- `/submit` 移动端标题不再出现过度碎裂换行。
- `/leaderboard/:modelKey` 移动端 H1 不占据过高首屏。
- 模型切换区域有明显可滚动或可选择 affordance。
- Relay 详情模型行状态不再被挤成难读的竖向块。
- Playwright mobile 覆盖首页、榜单详情、Relay 详情和提交页。

#### P1-4. 修复短页面 footer 贴底和移动端图标触摸区

对应问题：审阅问题 13、17。

整改方案：

- 页面 shell 使用纵向 flex 布局，内容不足时 footer 靠近视口底部。
- Footer 图标保持视觉尺寸也可以，但链接点击热区应扩大到约 44px。
- 错误页、`/probe`、短内容页面都复用同一个 shell 行为。

验收标准：

- `/probe`、404 页面和短内容页底部不再出现 footer 后大块浅色空白。
- Footer 图标在移动端有足够点击区域。
- Playwright mobile screenshot 覆盖短页面 footer。

#### P1-5. 优化 Relay 联系方式展示

对应问题：审阅问题 15。

整改方案：

- 空联系方式不渲染信息块。
- URL、邮箱、Telegram 等可识别联系方式转为可点击链接。
- 无法识别的联系方式按普通文本备注展示。

验收标准：

- 联系方式为“暂无”或空值时不显示该信息块。
- URL 联系方式可点击，并使用安全外链属性。
- Relay 详情页测试覆盖空联系方式和 URL 联系方式。

### P2：视觉区分度与品牌完成度优化

这些问题属于 polish，不应阻塞 P0/P1，但适合在主要体验稳定后统一处理。

#### P2-1. 强化赞助展示与自然排名的视觉分离

对应问题：审阅问题 16。

整改方案：

- 首页赞助区域增加更明确的 `赞助展示` 标签。
- 赞助卡使用与自然排名卡不同的背景、边框或结构。
- 避免赞助卡复用自然排名的排名序号和分数字段。
- 保留“独立展示，不参与榜单排序”的解释文案。

验收标准：

- 扫读首页时能明显区分赞助区和自然榜单区。
- 赞助卡不展示会被误认为自然排名的排序符号。
- Playwright screenshot 覆盖首页赞助区。

#### P2-2. 提升长页面模块节奏和信息层次

对应问题：审阅问题 18。

整改方案：

- 保留暖色、锐角和高对比基调，但为不同页面类型建立更明确的模块形态。
- 榜单页强化数据表格和状态解释，而不是全部卡片化。
- 方法页强化步骤、权重和治理规则的可视化表达。
- 表单页强化流程感，例如“填写信息 -> 自动测试 -> 提交审核”。

验收标准：

- 首页、榜单页、方法页、提交页在视觉形态上有明显区分。
- 不牺牲现有中文解释性和 sponsor separation。
- 设计调整通过桌面和移动端截图回归。

## 建议提交切片

建议按以下顺序实施和提交，每个切片独立验证：

1. `fix(seo): add public crawl and icon assets`
2. `fix(routes): render durable public not-found states`
3. `fix(metadata): make critical public pages crawlable`
4. `fix(rankings): normalize unavailable relay badges`
5. `fix(public-api): add cache headers for public reads`
6. `fix(relay): clarify health sample coverage`
7. `fix(probe): localize required field validation`
8. `fix(web): improve mobile public page layouts`
9. `fix(relay): make contact info actionable`
10. `style(web): separate sponsor cards from rankings`
11. `style(web): refine public page module rhythm`

## 验证计划

本地验证：

- `pnpm test`
- `pnpm test:e2e`
- 针对 SEO、404、榜单状态、移动端布局补充或更新 Playwright 用例。

线上发布后验证：

- `pnpm test:e2e:deployed`
- `curl -I https://relaynew.ai/robots.txt`
- `curl -I https://relaynew.ai/sitemap.xml`
- `curl -I https://relaynew.ai/favicon.ico`
- `curl -I https://api.relaynew.ai/public/home-summary`
- `curl -I https://api.relaynew.ai/public/leaderboard-directory`
- 浏览器复查首页、榜单页、所有模型榜单、所有 Relay 详情、方法页、提交页、测试页、无效动态路由和普通 404。

## 完成定义

- P0 全部完成后，站点不再把基础资源、无效路由和不可用 Relay 展示成可信正常状态。
- P1 全部完成后，中文校验、移动端首屏、移动端榜单和 Relay 详情达到可稳定使用标准。
- P2 全部完成后，赞助区、榜单、方法页和表单页的视觉差异更清楚，整体品牌完成度更高。
- 每个整改切片都有测试或明确的人工验收记录。
