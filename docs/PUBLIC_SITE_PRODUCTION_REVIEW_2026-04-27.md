# Production Public Site Review - 2026-04-27

## 审阅说明

- 审阅对象：`https://relaynew.ai/`
- 审阅时间：2026-04-27（Asia/Shanghai）
- 审阅方式：先阅读 `DESIGN.md`、架构、数据库、API、开发计划、测试策略、探测安全和路由文档来理解产品目标；页面问题只基于线上真实页面、线上 API、浏览器交互和截图判断。
- 未改动现有代码；本文件只记录线上问题与修改建议。
- 临时截图与采集数据在 `/tmp/relay-review-prod/`。

## 产品目标理解

线上公开站点应完成这些核心任务：

- 让普通用户发现可用的大模型 API Relay，并比较健康度、延迟、价格和可信度。
- 让榜单排序保持可解释，并明确区分自然排名与赞助展示。
- 让 Relay 详情页能解释某个站点支持哪些模型、近期可用性、代表延迟和当前价格。
- 让用户可以提交站点和进行自助测试，同时保护用户输入的 API Key。
- 公开页面应适合分享、索引和移动端浏览；中文体验应完整。

## 已查看页面

- `/`
- `/leaderboard`
- `/leaderboard/directory`，已确认重定向到 `/leaderboard`
- `/leaderboard/claude-opus-4-6`
- `/leaderboard/claude-opus-4-7`
- `/leaderboard/claude-sonnet-4-6`
- `/leaderboard/gemini-3.1-pro-preview`
- `/leaderboard/gpt-5.4`
- `/leaderboard/gpt-5.5`
- `/relay/easyrouter`
- `/relay/vtok-ai`
- `/relay/relay-router`
- `/methodology`
- `/policy`，已确认重定向到 `/methodology#governance`
- `/submit`
- `/probe`
- `/review-not-found`
- `/submissions`
- `/leaderboard/not-a-real-model`
- `/relay/not-a-real-relay`
- 额外检查：`/robots.txt`、`/sitemap.xml`、`/favicon.ico`、线上公共 API 缓存头、`/probe` 空表单与 dummy 失败结果展示。

## 高优先级问题与建议

### 1. 公开页面首屏 HTML 没有真实内容

- 问题：直接请求 `https://relaynew.ai/` 返回的 HTML 只有 `#root`、JS 和 CSS，首页正文、榜单、Relay 详情、方法页正文都需要客户端执行后才出现。
- 影响：公开榜单和 Relay 详情本应适合搜索引擎索引、社交分享和低 JS 环境访问；当前页面对非 JS 爬虫几乎没有主体内容。
- 建议：优先为 `/`、`/leaderboard`、`/leaderboard/:modelKey`、`/relay/:slug`、`/methodology` 做静态预渲染或 Workers SSR。MVP 可以先生成快照 HTML，保留客户端二次加载刷新。

### 2. `robots.txt`、`sitemap.xml`、`favicon.ico` 都被 SPA fallback 命中

- 问题：`/robots.txt` 返回首页 HTML；`/sitemap.xml` 返回 HTML；`/favicon.ico` 也返回 HTML 且 `content-type: text/html`。
- 影响：搜索引擎无法读取站点地图和爬取策略；浏览器和分享渠道拿不到基础品牌图标；这些路径返回 200 HTML 会掩盖部署配置错误。
- 建议：在 Cloudflare Workers Static Assets 或构建产物中加入真实 `robots.txt`、`sitemap.xml`、`favicon.ico`、`apple-touch-icon` 和 manifest，并让这些路径绕过 SPA fallback。

### 3. 未知动态路由返回 200 且错误态裸露英文

- 问题：`/leaderboard/not-a-real-model` 返回 HTTP 200，页面只显示 `Model not found`；`/relay/not-a-real-relay` 返回 HTTP 200，页面只显示 `Relay not found`；canonical 还指向无效路径。
- 影响：用户看不到中文解释或返回路径；搜索引擎可能把无效页面当正常页面收录；控制台出现 API 404。
- 建议：动态详情页加载 404 时渲染中文错误页，提供“返回模型目录”“提交站点”“开始测试”等入口。能在 Worker 层识别的无效路由应返回 HTTP 404；无法识别时至少设置 `noindex` 并避免把 canonical 指向无效路径。

### 4. 普通 404 页面会自动跳回首页，且同样返回 200

- 问题：`/review-not-found` 和 `/submissions` 显示“页面不存在，正在返回首页...”，几秒后自动跳转；页面无标题层级、无按钮、无倒计时，HTTP 状态仍是 200。
- 影响：用户无法停留、复制或排查错误链接；搜索引擎也无法准确理解这是不存在的页面。
- 建议：改为静态 404/未找到页面，保留明确 H1、说明、主 CTA 和次 CTA。不要自动跳转，最多提供“返回首页”按钮。HTTP 状态应为 404。

### 5. 0% 可用的 Relay 仍获得“低延迟”徽章并在自然排名中普通展示

- 问题：`Relay Router` 在多个榜单中 24H 可用性为 `0.00%`，状态为“不可用”或“降级”，但仍显示 `低延迟` 徽章，并以普通排名行展示。例如 `gpt-5.5` 中 0% 可用仍有 148 ms 和 `低延迟`。
- 影响：失败请求的快速返回会被误读为性能好；用户可能选择完全不可用的站点。榜单可信度会被削弱。
- 建议：可用性低于阈值时禁用“低延迟”徽章，不把失败响应时间作为正向延迟优势。不可用 Relay 可保留在榜单底部，但应有明确“不可用/观察中”分区或强提示。

### 6. 首页聚合状态与详情页状态表达不一致

- 问题：首页 API 显示 `totalRelays=3`、`healthyRelays=1`、`degradedRelays=2`、`downRelays=0`；但 `Relay Router` 详情页多个模型均为 `currentStatus=down`，榜单卡片也显示多处“不可用”。
- 影响：用户从首页得到“没有不可用站点”的印象，进入榜单后却看到 0% 可用的站点，状态口径不一致。
- 建议：统一首页、榜单、详情页的健康聚合规则。若 Relay 级别和模型级别状态不同，页面应说明口径；首页至少显示“不可用模型/不可用站点”或“观察中”数量。

### 7. 7 天可用性看起来像完整 7 天数据，但实际大量为空样本

- 问题：Relay 详情页的 7 天状态条常见 6 个灰色未知块 + 1 个当天状态块，但同时显示 `7D 可用性 100.00%`。线上 API 中这些灰块对应 `unknown` 和 `availability: null`。
- 影响：用户容易误解为连续 7 天都稳定，实际可能只有一天或少量样本。虽然有“样本偏少”徽章，但它经常被折叠为 `+1`。
- 建议：将指标改为“已观测样本可用性”或显示“仅 1 天样本”。灰色块应有图例或 tooltip；低样本时把“样本偏少”显性展示，不要隐藏进 `+1`。

## 中优先级问题与建议

### 8. `/probe` 空提交仍使用英文浏览器默认校验

- 问题：点击 `/probe` 的“开始测试”且未填写字段时，出现英文原生提示 `Please fill out this field.`。主页快速测试卡片也有同样问题。
- 影响：中文站点体验不完整，错误提示不可持久，也没有同步在结果面板或表单底部汇总。
- 建议：关闭原生 required 气泡或补充自定义校验。用中文在字段下方和结果区域显示“请填写 Base URL / API Key / 模型”，并聚焦到第一个错误字段。

### 9. 移动端首页信息顺序反了

- 问题：移动端首页首屏先展示“快速测试”表单，再展示主标题和产品说明。
- 影响：新用户还没理解产品定位就先看到表单，首屏叙事被打断。
- 建议：移动端先展示品牌主标题、价值说明、核心 CTA 和关键指标，再展示快速测试。快速测试可以作为第二屏卡片或折叠入口。

### 10. 移动端大标题和模型名排版压迫感强

- 问题：`/submit` 的中文长标题在移动端被切成多段不自然短行；`/leaderboard/claude-opus-4-6` 的 H1 占据过高首屏；`gemini-3.1-pro-preview` 等模型名在卡片中断行生硬。
- 影响：页面显得未针对移动端设计，阅读效率低。
- 建议：移动端单独设置标题字号和行高，给模型 key 使用更紧凑的标签样式。可以保留 canonical modelKey，但增加 vendor/family 小标签和可控换行。

### 11. 移动端模型切换条只露出半个按钮

- 问题：榜单详情页移动端“切换模型”区域横向按钮只露出下一项的一部分，没有滚动提示。
- 影响：用户不容易知道可以横向滑动，也容易误触。
- 建议：改成横向滚动 chips 加左右渐隐遮罩，或在移动端使用 select / bottom sheet。当前激活模型应保持可见，并提供“全部模型”返回入口。

### 12. Relay 详情移动端状态列被挤压

- 问题：Relay 详情卡片右侧状态会显示成上下两行，例如“健康 / 可用”“不可用 / 降级”，部分长模型名下视觉拥挤。
- 影响：状态是高优先级信息，但当前位置阅读效率低。
- 建议：移动端将状态放在模型名下方左侧，使用单行 badge，如“健康 · 可用”“不可用 · 降级”。价格、延迟和可用性继续用指标卡呈现。

### 13. 短页面页脚没有贴底

- 问题：`/probe`、错误页和部分短内容详情页中，深色 footer 出现在页面中部，下方仍有大块浅色空白。
- 影响：页面完成度差，尤其错误页看起来像布局中断。
- 建议：页面 shell 使用 `min-height: 100vh` 的纵向 flex 布局，让 footer 在内容不足时贴近视口底部。

### 14. 线上公共 API 没有明确缓存头

- 问题：`https://api.relaynew.ai/public/home-summary`、`/public/leaderboard-directory`、`/public/relay/easyrouter/overview` 的响应头没有 `Cache-Control` 或 `Cloudflare-CDN-Cache-Control`。
- 影响：公开读接口更容易直接打到源站，也不利于稳定快速加载公开页面。
- 建议：为 `GET /public/*` 统一加短 TTL 和 stale 策略。例如浏览器 `max-age=15`，Cloudflare `max-age=60, stale-while-revalidate=300, stale-if-error=600`。写接口 `/public/probe/check` 和 `/public/submissions` 继续不缓存。

### 15. 联系方式展示不够可操作

- 问题：`Easyrouter` 联系方式展示为“暂无”，仍占一个信息块；`VTok.ai` 联系方式包含 URL，但页面只展示为文本，不是可点击链接。
- 影响：空信息增加噪音；可操作联系方式不能直接点击，降低转化和纠错效率。
- 建议：空联系方式不要展示；识别 URL、邮箱、Telegram、QQ群等类型并做对应交互。无法自动识别时显示为普通备注。

## 低优先级问题与建议

### 16. 赞助展示与普通卡片视觉差异还不够强

- 问题：首页赞助区有“独立展示，不参与榜单排序”说明，但卡片视觉和自然榜单卡片较接近。
- 影响：用户能读到分离说明，但扫读时仍可能把赞助卡误认为自然排名的一部分。
- 建议：赞助区增加明确的 `赞助展示` 标签、不同底色或边框语言，并避免使用与自然排名完全相同的得分/状态布局。

### 17. Footer 图标触摸目标偏小

- 问题：移动端底部 Rebase / GitHub 图标视觉尺寸约 19px，触摸目标小于常见 44px。
- 影响：移动端点击困难，也不利于无障碍。
- 建议：扩大可点击区域，不一定放大图标本身；给链接添加 44px 左右的透明点击热区。

### 18. 页面模块形态重复，长页面节奏偏单一

- 问题：多数模块使用相似白卡、细边框、顶部黄橙短条、方形按钮。暖色品牌方向明确，但榜单、详情、方法页之间区分度不足。
- 影响：长时间浏览会感觉模板化，品牌记忆点主要依赖颜色和大标题。
- 建议：保留暖色和锐角基调，但为榜单表格、方法页解释卡、表单区分别建立更清晰的模块形态。例如榜单强化数据表格，方法页强化步骤和权重图，表单页强化流程进度。

## 正向观察

- 线上没有发现本地审阅中出现的明显测试 Relay 数据泄露。
- `/policy` 能正确跳转到 `/methodology#governance`。
- `/leaderboard/directory` 能正确跳转到 `/leaderboard`。
- `/probe` 使用 dummy key 和 `https://example.com` 测试失败时，结果页没有回显 API Key，并能解释 HTTP 405、兼容模式和下一步建议。
- `/submit` 空提交使用中文错误提示，优于 `/probe` 的原生英文校验。
