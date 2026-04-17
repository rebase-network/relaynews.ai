# 2026-04-17 自动改进实施方案（5 轮）

## 目标

围绕以下总目标推进至少 5 轮自动改进：

- 面向中国用户与运营团队，完成核心界面中文化
- 提升公共页面的信息完整度与解释性
- 收紧 `public / admin` 代码边界与公共缓存策略
- 改善 SEO 基础能力与页面级 metadata
- 通过 Playwright、API 验证和代码复审形成新的中文验收基线

## 总体执行原则

- 每一轮都遵循：审阅 -> 方案 -> 实施 -> 复审 -> 测试 -> 提交
- 每一轮至少明确覆盖以下三类用户中的一类：
  - 运营人员
  - 普通用户
  - 中转站节点运营者
- 每轮优先做小而明确、可以独立提交的功能切片
- 文档、测试与实现同步推进，避免再次漂移

## 第 1 轮：建立审阅与执行基线

### 目标

- 将首轮问题审阅正式写入仓库文档
- 明确 5 轮迭代的执行顺序与验收目标

### 主要用户

- 运营人员
- 产品维护者

### 拟修改文件

- `docs/improvement-cycles/2026-04-17-audit-round-01.md`
- `docs/improvement-cycles/2026-04-17-execution-plan.md`

### 风险

- 风险较低，重点是确保问题描述与实际实现一致

### 验证方式

- 人工校对文档内容
- 确认问题、优先级、用户视角与后续迭代顺序一致

## 第 2 轮：前后台中文化与中国用户展示规则

### 目标

- 将前台和后台的核心导航、按钮、表单、帮助信息、状态提示改为中文
- 统一 `zh-CN`、时间与数字展示策略
- 让运营人员、普通用户、中转站节点运营者的主要操作路径都可以中文完成

### 主要用户

- 运营人员
- 普通用户
- 中转站节点运营者

### 拟修改文件

- `apps/web/index.html`
- `apps/admin/index.html`
- `apps/web/src/app.tsx`
- `apps/admin/src/app.tsx`
- `docs/LOCALIZATION_ZH_CN.md`

### 风险

- 文案修改量较大，容易导致 Playwright 断言失效
- 部分状态文案需兼顾产品准确性与中文易懂性

### 验证方式

- `pnpm typecheck`
- 重点运行公共站与后台的 Playwright 场景
- 人工检查移动端导航、表单标签、操作反馈、时间格式

## 第 3 轮：补齐公共页的信息完整度

### 目标

- 首页补齐最近异常 / 事故模块与更明确的信任说明
- 榜单页补齐自然排名解释、赞助分层说明、面向普通用户的阅读提示
- Relay 详情页补齐事故时间线与价格历史展示

### 主要用户

- 普通用户
- 中转站节点运营者

### 拟修改文件

- `apps/web/src/app.tsx`
- `apps/api/src/routes/public.ts`
- `packages/shared/src/public.ts`
- `e2e/public.spec.ts`
- `docs/ROUTES.md`

### 风险

- 公共页模块变多后，移动端布局可能需要重新调整
- Relay 页面新增模块后，加载与空状态逻辑需要补齐

### 验证方式

- `pnpm test:e2e --grep public`
- 人工检查桌面端与移动端布局
- 确认 sponsor 与自然排序始终分离

## 第 4 轮：收紧 API 边界与公共缓存策略

### 目标

- 为 `/public/*` 统一补充缓存头策略
- 将 `/public/submissions` 及其 schema 从 admin 组织中拆分出去
- 明确 `public / admin / internal` 代码责任边界

### 主要用户

- 运营人员
- 平台维护者

### 拟修改文件

- `apps/api/src/routes/public.ts`
- `apps/api/src/routes/admin.ts`
- `packages/shared/src/public.ts`
- `packages/shared/src/admin.ts`
- `packages/shared/src/index.ts`
- 新增 `apps/api/src/routes/public-submissions.ts` 或等价拆分文件
- `docs/ARCHITECTURE.md`
- `docs/INTERNAL_API_NOTES.md`

### 风险

- 路由拆分后容易引入类型导出或导入回归
- 缓存头策略需要避免误作用于 admin 接口

### 验证方式

- `pnpm test`
- 针对 `/public/*` 做响应头检查
- 核对 admin 接口不被缓存

## 第 5 轮：SEO 基础能力、测试升级与复审修复

### 目标

- 补齐首页、榜单页、Relay 详情页、提交页、Probe 页的 route-level title / description / canonical 基础能力
- 将 Playwright 断言与产品基线切换为中文
- 增补公共 API 缓存头与中文 UI 的测试
- 做一轮代码复审并修复发现的问题

### 主要用户

- 普通用户
- 运营人员
- 平台维护者

### 拟修改文件

- `apps/web/index.html`
- `apps/web/src/app.tsx`
- `e2e/public.spec.ts`
- `e2e/admin.spec.ts`
- `apps/api/src/**/*.test.ts`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/TESTING_STRATEGY.md`

### 风险

- SEO 能力在纯 CSR 前提下只能做到过渡优化，无法完全替代 SSR / pre-render
- 中文断言切换后，测试容易暴露已有但未显现的页面问题

### 验证方式

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- 对失败项进行复审与补丁修复

## 收口标准

完成 5 轮后，至少应满足以下结果：

- 公共站和后台的核心路径为中文
- 首页、榜单、Relay 详情页信息完整度较当前版本明显提升
- `/public/*` 具备明确缓存头策略
- `public / admin` 路由组织比当前更清晰
- Playwright 中文验收基线建立完成
- 相关文档已同步更新，可支持继续迭代

## 执行进展（截至 2026-04-17）

### 第 1 轮状态：已完成

已完成内容：

- 已完成首轮审阅文档与 5 轮实施方案文档落库：
  - `33ebe41` `docs(review): record audit findings and five-pass plan`

验证记录：

- 已人工核对 `DESIGN.md`、架构 / 路由 / API / 测试 / 安全文档与当前实现之间的差异。

遗留问题：

- 无。该轮主要用于建立后续自动迭代基线。

### 第 2 轮状态：已完成

已完成内容：

- 后台中文化主改造：
  - `da94c1e` `feat(admin): localize admin console to zh-CN`
  - `bc78824` `fix(admin): polish zh-cn operator copy`
- 前台中文化主改造：
  - `d4bd72b` `feat(web): localize public experience to zh-cn`
- 中文时间展示进一步固定中国时区：
  - `8005548` `fix(web): harden relay detail states and cache behavior`

验证记录：

- 核心导航、表单、按钮、状态文案已切换为中文。
- 管理后台日期时间已固定 `Asia/Shanghai`，便于中国运营团队统一判断。
- 中文化后的后台 E2E 已收敛：
  - `6220ca6` `test(e2e): update admin checks for zh-CN console`

遗留问题：

- 仍需继续补充运营操作手册与更细的中文文案规范，但核心路径已可用。

### 第 3 轮状态：已完成

已完成内容：

- 公共页信息完整度补齐：
  - `8fbc02d` `feat(web): enrich public ranking and relay detail modules`
- 首页已补齐最近事件模块与风险提示入口。
- 榜单页已补齐自然排名 / 方法论入口 / 赞助分离说明。
- Relay 详情页已补齐价格历史与事故时间线模块。
- Relay 详情加载失败时的趋势 / 状态 / 价格 / 事故模块错误态已补齐：
  - `8005548` `fix(web): harden relay detail states and cache behavior`

验证记录：

- `e2e/public.spec.ts` 已切换为中文产品路径断言，并覆盖首页、榜单、Relay 详情、提交、Probe 与移动端可用性。
- 本地执行通过：
  - `PLAYWRIGHT_VIDEO=off corepack pnpm exec playwright test e2e/public.spec.ts`

遗留问题：

- SEO metadata 仍未随该轮一并落地，后续需要单独收口。

### 第 4 轮状态：已完成

已完成内容：

- `public / admin` 代码边界与公共缓存策略已经落地：
  - `c73b2d3` `refactor(api): split public submission contracts and cache public reads`
  - `5949192` `docs(api): record public cache and route boundaries`
- `/public/submissions` 已移入 public 边界，shared contract 也已拆分。
- 公共 `GET /public/*` 已统一注入缓存头。
- 错误响应不再附带公共缓存头：
  - `8005548` `fix(web): harden relay detail states and cache behavior`

验证记录：

- 新增 API E2E：
  - `df3bb00` `test(e2e): stabilize zh-cn acceptance coverage`
- 已验证：
  - public 成功 `GET` 返回缓存头
  - public `404` 不返回缓存头
  - public 写接口不返回缓存头

遗留问题：

- internal 层仍以文档约束为主，尚未拆成更明确的实现模块。

### 第 5 轮状态：部分完成

已完成内容：

- 第 5 轮的“复审 -> 修复 -> 测试升级”部分已完成：
  - `8005548` `fix(web): harden relay detail states and cache behavior`
  - `df3bb00` `test(e2e): stabilize zh-cn acceptance coverage`
- 第 5 轮的“公共页 SEO 基础能力”已继续补齐：
  - route-level `title`
  - `meta[name="description"]`
  - `canonical`
  - 基础 `og:*` / `twitter:*` 同步
- 已完成内容包括：
  - public / admin E2E 中文断言对齐
  - API 缓存头 E2E 覆盖
  - 首页、榜单页、Relay 详情页、方法论、政策、提交、Probe 的页面级 metadata
  - 本地 macOS Chrome 回退，规避 Playwright 浏览器下载阻塞
  - 默认关闭视频录制，避免 ffmpeg 缺失导致测试无法启动
  - Postgres 迁移 / seed 重试，减少数据库刚启动时的 flake

验证记录：

- `corepack pnpm test`
- `PLAYWRIGHT_VIDEO=off corepack pnpm test:e2e`
- public metadata smoke 已加入 `e2e/public.spec.ts`
- 当前结果：
  - 单元 / 类型检查通过
  - Playwright 全量通过 `19 passed`
  - `1 skipped` 为依赖本地 `LLM_API_TYPE` 手动兼容模式配置的 Probe 场景，不属于失败

遗留问题：

- 当前 SEO 仍属于 CSR 条件下的基础能力，尚未覆盖 SSR / 预渲染、结构化数据、OG 图片等更强能力。
- Probe 更强的安全硬化（限流、Turnstile、上线前边界）仍需继续推进。
- 若后续准备面向搜索流量或公开更大规模使用，应优先继续处理 SEO 与 Probe 安全项。

### 文档复审补充：已完成

已完成内容：

- 针对“文档是否落后于实现”追加完成两轮收口：
  - `d6f99f7` `docs(review): refresh product and api status`
  - `730dda6` `docs(review): refresh deployment and schema notes`
- 已补齐或修正的重点文档包括：
  - `DESIGN.md`
  - `docs/ARCHITECTURE.md`
  - `docs/API_CONTRACT_V1.md`
  - `docs/DEVELOPMENT_PLAN.md`
  - `docs/PROBE_SECURITY.md`
  - `docs/ROUTES.md`
  - `docs/TESTING_STRATEGY.md`
  - `docs/DATABASE_SCHEMA.md`
  - `docs/DEPLOYMENT.md`
  - `docs/CLOUDFLARE_WORKERS_BUILDS.md`
  - `docs/INTERNAL_API_NOTES.md`
- 本轮还新增了第 2 次文档复审记录：
  - `docs/improvement-cycles/2026-04-17-audit-round-02.md`

验证记录：

- 已将文档内容与当前迁移、public/probe 路由实现、shared contract、部署脚本和 Workers 配置逐项对齐。
- 重点收口了以下容易误导后续开发与运营的过时点：
  - 数据库 schema 已不再只是 `0001_initial.sql`
  - `POST /public/submissions` 与 `POST /public/probe/check` 的 key 持久化边界不同
  - `relaynew.ai` / `admin.relaynew.ai` 的生产发布必须走 GitHub-triggered Workers Builds
  - 当前仓库尚未暴露独立 `/internal/*` HTTP surface

遗留问题：

- 如果后续再引入 staging frontend 域名、更多 region 或独立 internal route，需要同步更新上述文档，避免再次漂移。

### 运营手册补充：已完成

已完成内容：

- 已新增中文运营后台操作手册：
  - `docs/ADMIN_OPERATIONS.md`
- 手册内容已经对齐当前后台的真实能力边界，包括：
  - 登录与时区口径
  - `概览`、`审核队列`、`中转站`、`密钥`、`赞助位`、`价格` 的页面职责
  - 提交审核、Relay 接管、密钥轮换、价格追加等日常流程
  - 当前 UI 未覆盖、需要工程介入的限制项

验证记录：

- 已根据以下实现逐项核对手册内容：
  - `apps/admin/src/app.tsx`
  - `apps/api/src/routes/admin.ts`
  - `apps/api/src/app.ts`
  - `packages/shared/src/admin.ts`

遗留问题：

- 如果后续补上更多后台写操作入口，需同步更新本手册。

## 2026-04-18 后续重排计划

在完成原始 5 轮自动改进后，下一阶段的重点不再是继续堆叠后台入口，
而是先收敛运营路径、澄清 Relay 生命周期，再做组件化拆分。

### 新确认的产品方向

- `approved` 的提交记录不应继续停留在当前提交列表中，而应进入 `提交记录历史`，
  同时创建或关联到 `Relay` 列表，便于运营查看完整审核轨迹。
- `提交记录` 页面只保留当前待处理队列；`approved`、`rejected`、`archived`
  全部进入历史视图。
- `Relay` 成为长期运营主界面：
  - 主列表只展示 `active` 和 `paused`
  - `archived` 只进入 Relay 历史
  - `paused` 与 `archived` 都允许重新激活
- 只有 `active` Relay 才参与自动测试、公开目录展示和榜单排名。
- Relay 编辑页需要统一承载以下信息：
  - 站点名字
  - 站点网站
  - 联系方式
  - 站点简介
  - `Base URL`
  - 测试 `API Key`
  - 支持的模型及价格表（每行包含模型、Input 价格、Output 价格）
- 前台 `/submit` 提交页也需要同步升级为同一套字段结构，避免“提交页一套、
  后台 Relay 编辑页另一套”的数据漂移。
- 管理员可以在后台手动新增 Relay。
- API Key 的日常添加与轮换不再作为独立后台主工作区，而是并入 Relay 编辑
  或后台受控操作流。
- `apps/admin/src/app.tsx` 与 `apps/web/src/app.tsx` 的超大单文件问题需要作为
  独立工程目标处理，避免后续继续堆高维护成本。

### 下一阶段执行顺序

#### 第 6 轮：文档、契约与数据模型先行

目标：

- 先将新的后台流程和状态规则落入计划文档，再同步到 schema / route / admin
  操作文档，避免实现过程中再次漂移。
- 明确新增或扩展的数据字段与结构，例如：
  - Relay / Submission 的联系方式
  - Submission 侧的模型价格明细表
  - `active / paused / archived` 的公开展示与测试边界

验证方式：

- 文档逐项校对
- shared contract 与数据库迁移草案复核

#### 第 7 轮：后台信息架构收敛

目标：

- 将后台主导航收敛为更清晰的运营路径：
  - `提交记录`
  - `提交记录历史`
  - `Relay`
  - `Relay 历史`
  - `赞助位`
  - 低频模型设置
- 同步调整前台 `/submit` 表单，支持可增删的模型价格表输入，并与后台 Relay
  编辑页共用同一套字段口径。
- 提供手动新增 Relay 与完整 Relay 编辑入口。
- 将价格维护并入 Relay 编辑，不再把 `价格` 当作高频独立入口。

验证方式：

- 后台导航与状态流转人工走查
- Playwright 覆盖提交审核、历史查看、Relay 编辑与手动新增

#### 第 8 轮：后端生命周期与公开规则收敛

目标：

- 调整审核通过后的落库与状态迁移逻辑：
  - 提交记录进入历史
  - Relay 直接进入列表
  - 未通过审核的记录不再出现在当前提交队列
- 收紧 API 与调度逻辑，确保只有 `active` Relay 参与：
  - 自动测试
  - 目录展示
  - 榜单排名
- `paused` / `archived` Relay 不进入公开面，但允许重新激活。

验证方式：

- API / 调度逻辑测试
- 审核通过、暂停、归档、重新激活的端到端校验

#### 第 9 轮：admin / web 组件化拆分

目标：

- 按页面和 feature 边界拆分 `apps/admin` 与 `apps/web` 的巨型入口文件。
- 优先抽离：
  - route page 容器
  - feature section
  - 数据加载 hooks
  - 表单 schema / mutation 封装
  - 公共格式化与 UI 组件
- 先降低维护成本，再继续叠加后台能力。

验证方式：

- `pnpm typecheck`
- 关键页面回归测试
- 重点检查提交流程、Relay 编辑、首页与榜单页未出现 UI 退化

#### 第 10 轮：复审、测试与运营文档收口

目标：

- 对新流程做一轮代码复审，记录问题并补丁修复。
- 用 Playwright、本地测试数据和 API 脚本补齐关键回归覆盖。
- 同步更新 `docs/ADMIN_OPERATIONS.md`、`docs/ROUTES.md`、`docs/ARCHITECTURE.md`
  等文档，使运营手册与实现再次对齐。

验证方式：

- `pnpm test`
- `PLAYWRIGHT_VIDEO=off corepack pnpm test:e2e`
- 文档与实现交叉审阅

### 下一阶段收口标准

- 当前提交列表只展示待处理记录，审核通过与拒绝记录都可在历史中追溯
- Relay 列表和 Relay 历史的状态边界清晰，重新激活路径明确
- 只有 `active` Relay 会被测试并进入目录 / 榜单
- 后台和前台巨型单文件被拆分到可维护的 page / feature 结构
- 中文运营路径、普通用户路径和节点运营者路径都具备可回归测试的验收基线
