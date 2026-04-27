# Local Public Site Review Round 2 - 2026-04-27

## 审阅说明

- 审阅对象：`http://127.0.0.1:4173/`
- 审阅时间：2026-04-27（Asia/Shanghai）
- 审阅方式：先阅读 `DESIGN.md`、架构、数据库、API、开发计划、测试策略、探测安全和路由文档来理解产品目标；页面结论只基于本地真实浏览器渲染、HTTP 响应、静态资源和表单交互。
- 未改动现有代码；本文件只记录本轮发现的问题。
- 临时截图与采集数据：`/tmp/relay-review-local-round2/`
- 本轮使用子任务交叉检查了功能/SEO 与视觉/移动端体验。

## 产品目标理解

本地公开站点应服务于这些核心目标：

- 让用户发现和比较大模型 API Relay，重点看健康度、延迟、价格、模型覆盖和可信度。
- 让模型榜单排序可解释，并保持赞助展示与自然排名明确分离。
- 让 Relay 详情页解释站点身份、Base URL/endpoint 摘要、支持模型、近期可用性、延迟、价格和最近验证时间。
- 让用户可以提交站点和进行自助测试，同时避免在页面或 API 响应中回显用户输入的 API Key。
- 公开页面应适合中文用户阅读、移动端浏览、搜索引擎索引和链接分享。

## 已查看页面

### 公共页面

- `/`
- `/leaderboard`
- `/leaderboard/directory`
- `/leaderboard/anthropic-claude-sonnet-4.6`
- `/leaderboard/anthropic-claude-opus-4.6`
- `/leaderboard/openai-gpt-5.4`
- `/leaderboard/google-gemini-3.1`
- `/leaderboard/anthropic-claude-sonnet-4`
- `/leaderboard/openai-gpt-4.1`
- `/leaderboard/openai-gpt-4.1-mini`
- `/relay/aurora-relay`
- `/relay/ember-gateway`
- `/relay/solstice-router`
- `/methodology`
- `/policy`
- `/submit`
- `/probe`

### 错误与兼容路由

- `/not-a-real-page`
- `/leaderboard/not-a-real-model`
- `/relay/not-a-real-relay`
- `/submissions`

### 静态资源

- `/robots.txt`
- `/sitemap.xml`
- `/favicon.ico`

## 功能与 SEO 问题

### P0. 移动端模型榜单详情页面被横向撑宽

- 页面：所有 `/leaderboard/:modelKey`，实测 `/leaderboard/anthropic-claude-sonnet-4.6`
- 问题：在 `390px` 移动视口下，页面截图宽度被撑到约 `756px`。模型切换条和榜单内容超出手机视口，用户需要横向移动才能完整查看。
- 影响：这是当前最直接影响移动端可用性的缺陷。模型榜单是核心页面，移动端用户会误以为页面布局坏掉或内容不可读。
- 证据：`/tmp/relay-review-local-round2/mobile-homeleaderboard_anthropic-claude-sonnet-4.6.png`

### P0. 公开页面首屏 HTML 仍是通用 SPA 壳

- 页面：`/`、`/leaderboard`、`/leaderboard/:modelKey`、`/relay/:slug`、`/methodology`、`/submit`、`/probe`、404 页面
- 问题：直接请求页面 HTML 时，所有路由都返回同一份通用 HTML，初始 `<title>`、description、canonical 和正文内容都不是当前路由的真实内容。浏览器执行 JS 后页面内 metadata 会变正确，但非 JS 爬虫和很多分享抓取器只能看到通用首页信息。
- 影响：公开榜单和 Relay 详情的 SEO、分享卡片、无 JS 可读性仍不满足公共站目标。
- 证据：`curl /relay/aurora-relay`、`curl /leaderboard/anthropic-claude-sonnet-4.6`、`curl /not-a-real-page` 均返回通用 `relaynew.ai｜大模型API服务站监控、榜单与测试` HTML 壳。

### P1. 无效路由和兼容路由的 HTTP 语义不准确

- 页面：`/not-a-real-page`、`/leaderboard/not-a-real-model`、`/relay/not-a-real-relay`
- 问题：浏览器内能显示中文错误页，并设置 `noindex`，但 HTTP 层仍返回 `200`。
- 影响：爬虫、监控和分享抓取器会把不存在页面误判成正常页面。前端 noindex 只能缓解一部分问题。
- 页面：`/leaderboard/directory`、`/policy`
- 问题：浏览器端会跳到 `/leaderboard` 与 `/methodology#governance`，但 HTTP 层不是真实 `3xx`。
- 影响：旧链接兼容性对用户可用，但对不执行 JS 的客户端和监控不够明确。
- 页面：`/submissions`
- 问题：当前是公共 404。若仍期望它作为旧提交入口兼容跳转，则本地页面未体现该兼容行为。

### P1. `sitemap.xml` 与当前真实页面不一致

- 页面：`/sitemap.xml`
- 问题：站点地图仍包含 `/leaderboard/gpt-5.4`、`/leaderboard/claude-opus-4-6`、`/relay/easyrouter` 等本地当前页面不存在或未收录的路径。
- 问题：站点地图缺少本地当前真实有效路径，例如 `/leaderboard/openai-gpt-5.4`、`/leaderboard/anthropic-claude-sonnet-4.6`、`/relay/aurora-relay`。
- 影响：搜索引擎会被引导到错误 URL，同时漏掉真实可访问页面。后续如果生产数据变化，静态 sitemap 也容易再次过期。

### P1. Relay 详情页缺少明确 Base URL / endpoint 摘要

- 页面：`/relay/aurora-relay`、`/relay/ember-gateway`、`/relay/solstice-router`
- 问题：API 数据中有 `baseUrl`，例如 `https://aurora.relaynew.ai/v1`，但详情页顶部只展示“官网”和“联系”，未展示正在被监控和测试的 Base URL 或 endpoint 摘要。
- 影响：用户无法直接判断榜单测试的是哪个接口路径，也不利于运营者核对收录信息。该项与 Relay 详情页应解释 endpoint 摘要的目标不一致。

### P1. Relay 详情内容存在数据质量与中文一致性问题

- 页面：`/relay/aurora-relay`
- 问题：页面标题是 Aurora Relay，但介绍正文中出现“为什么选择 EasyRouter？”这类疑似错配内容。
- 页面：`/relay/ember-gateway`、`/relay/solstice-router`
- 问题：站点简介仍是英文，例如 `Value-oriented relay with broad model coverage.` 和 `Throughput-first relay currently under observation.`
- 影响：公开中文站点的信任感和一致性被削弱。详情页像是直接展示未整理的原始运营资料，而不是可供用户决策的公开说明。

### P2. 联系方式展示可操作性不足

- 页面：`/relay/aurora-relay`、`/relay/ember-gateway`、`/relay/solstice-router`
- 问题：`Telegram：@aurora_ops`、`邮箱：support@ember.relaynew.ai`、微信群文本都作为普通文本展示，未转成可点击或可复制的明确交互。
- 影响：用户和站点运营者无法快速联系或发起纠错，降低详情页的实际可用性。

### P2. `favicon.ico` 内容类型与文件内容不匹配

- 页面：`/favicon.ico`
- 问题：HTTP 头返回 `image/x-icon`，但文件内容实际是 SVG XML。
- 影响：现代浏览器可能容忍，但传统浏览器、爬虫、书签、部分分享渠道可能无法正确识别图标。建议使用真实 `.ico`，或改为 `.svg` 并使用正确 MIME 与 HTML 引用。

## 视觉与 UX 问题

### P1. 移动端长模型 key 的视觉权重过高

- 页面：`/leaderboard`、`/leaderboard/:modelKey`
- 问题：`anthropic-claude-sonnet-4.6`、`anthropic-claude-opus-4.6` 等英文 key 在移动端标题和卡片中占据过多空间，视觉上压过中文说明。
- 影响：用户需要先理解一大段英文 slug，页面像数据 dump，而不是面向用户的目录和榜单。
- 建议方向：保留 canonical modelKey，但在视觉层加入更可读的供应商/系列/版本结构，或使用短展示名配合小号技术 key。

### P1. Relay 详情页缺少“摘要优先”的信息层级

- 页面：`/relay/aurora-relay`、`/relay/ember-gateway`、`/relay/solstice-router`
- 问题：桌面端顶部介绍后直接进入模型健康表格，表格前缺少清晰标题和整体状态摘要。移动端则变成连续模型卡片，没有先给“支持模型数、异常模型、整体健康、最近验证”的概览。
- 影响：详情页虽然数据完整，但用户需要自己扫描很长列表才能判断这个 Relay 当前是否值得使用。

### P1. 赞助展示仍复用自然排名的质量徽章语言

- 页面：`/`
- 问题：首页赞助区已独立分区，并写明“不参与榜单排序”，但赞助卡内仍显示“高性价比”“健康”等自然榜单式质量徽章。
- 影响：扫读时仍可能被理解为榜单背书。赞助区应更像商业展示，而不是自然排名卡片的变体。

### P2. 首页首屏信息竞争较强

- 页面：`/`
- 问题：桌面首屏同时承载大标题、三枚 CTA、三项指标和快速测试表单。视觉风格有冲击力，但产品叙事和工具入口在争夺注意力。
- 影响：新用户可能不知道优先做什么：浏览目录、开始测试，还是提交站点。

### P2. 移动端提交页标题过重，表单入口过深

- 页面：`/submit`
- 问题：移动端 H1 “把你的Relay站点信息提交...”占据大量首屏，断行较硬，表单被推到较深位置。
- 影响：提交页是任务型页面，首屏过度海报化会延迟用户进入表单。

### P2. 移动端目录页效率偏低

- 页面：`/leaderboard`
- 问题：移动端目录页以完整预览卡片长列表呈现。可读性尚可，但作为“模型目录”，用户要滚动较长距离才能看完所有模型。
- 影响：目录页更适合作为快速入口，目前更像首页榜单预览的延展。

### P2. `/probe` 未测试前的结果面板占比偏大

- 页面：`/probe`
- 问题：桌面端右侧结果面板在等待输入时占据较大面积；移动端结果面板也在表单后完整展开，但未提供实际结果。
- 影响：测试页的核心任务是输入和运行，空结果面板的视觉优先级偏高。

### P2. 小字号、触控尺寸和 placeholder 对比度仍可提升

- 页面：全站导航、表单、标签和 footer
- 问题：品牌副标题、导航辅助文案、标签和表单 placeholder 字号较小且颜色偏浅。移动端“打开菜单”按钮约 `80px x 40px`，高度低于常见 `44px` 触控建议。
- 影响：低视力用户和移动端用户阅读、点击会更吃力。

## 本轮已确认正常或明显改善的点

- 首页、模型目录、模型榜单、Relay 详情、方法论、提交、Probe、404 页面均可在浏览器中正常渲染。
- 移动端首页已先展示产品 hero，再展示快速测试表单。
- `/probe` 空表单使用中文校验；用 dummy key 测试 `https://example.com` 后页面和 API 响应未回显 key。
- `/submit` 空表单校验完整，中文错误提示可见。
- `/policy` 浏览器端可跳转到 `/methodology#governance`。
- `/leaderboard/directory` 浏览器端可跳转到 `/leaderboard`。
- `/robots.txt`、`/sitemap.xml`、`/favicon.ico` 不再被 SPA fallback 返回 HTML。
- 404 和无效动态路由已有中文说明、主 CTA 和 `noindex`。

## 未验证或本轮边界

- 未执行 `/submit` 成功路径，避免在本地数据中产生新的提交记录。本轮只验证空表单校验。
- 无法仅通过浏览器确认 `/probe` 的 API Key 是否未写入日志、trace 或数据库；本轮只确认页面和 API 响应没有回显 secret。
- 本轮对象是本地开发服务 `http://127.0.0.1:4173/`，不代表生产 Cloudflare Workers Static Assets 的真实缓存、状态码和边缘重定向行为。
