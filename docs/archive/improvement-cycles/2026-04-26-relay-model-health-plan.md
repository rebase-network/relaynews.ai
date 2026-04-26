# 2026-04-26 Relay 详情页模型健康看板改造计划

## 背景

当前 `relay` 详情页默认展示的是 relay 级综合指标，而不是 `relay × model`
级别的状态和延迟。

这会带来几个明显问题：

- `healthStatus`、`availability24h`、`latencyP50Ms`、`latencyP95Ms` 容易被用户误解为
  “这个 relay 下所有模型的统一表现”
- 同一个 relay 下，不同模型可能走不同路由、不同上游、不同可用性策略，relay 级聚合会
  抹平这些差异
- 某些模型可用、某些模型不可用的场景下，relay 级状态和延迟几乎没有解释价值
- 当前 relay 详情页更像“站点综合信息页”，而不是用户真正需要的“模型可用性看板”

与此相对，现有系统已经具备大量模型级聚合基础：

- `relay_status_5m` 已有 `model_id`
- `relay_latency_5m` 已有 `model_id`
- `relay_score_hourly` 已有 `model_id`
- `GET /public/relay/:slug/history` 已支持传入 `model`

因此，本轮改造的重点不是新增新的监控体系，而是把现有模型级数据变成面向用户的主视图。

## 改造目标

- 将 relay 详情页从“relay 级综合详情”改成“模型健康看板”
- 不再把 relay 级延迟和可用性作为主展示指标
- 直接在 relay 详情页中按模型展示：
  - 当前状态
  - 7 天可用性
  - 7 天状态趋势
  - 一个代表延迟值
  - 当前价格
  - 最后验证时间
- 保持页面信息密度足够高，让用户不必再点入单独模型详情页才能判断可用性

## 产品方向

### 1. relay 详情页回答的问题

改造后，relay 详情页不再重点回答：

- “这个 relay 整体快不快”
- “这个 relay 整体稳不稳”

而是重点回答：

- 这个 relay 支持哪些模型
- 每个模型当前能不能用
- 每个模型过去 7 天稳不稳
- 每个模型大概延迟如何
- 每个模型当前价格如何

### 2. 只做紧凑版，不做展开详细版

本轮仅实现紧凑版“模型健康卡 / 表格行”，不做每模型展开详情。

原因：

- 用户当前主要关注可用与否，而不是做深度性能诊断
- 逐模型大图会拉长页面，降低列表可扫描性
- 先把模型级状态看板做清楚，比做更多细节更重要

### 3. 状态优先，延迟次之

在每模型一行中，优先级应为：

1. 当前状态
2. 7 天可用性
3. 7 天状态迷你条
4. 代表延迟值
5. 当前价格
6. 最后验证时间

延迟只展示一个代表数值，建议第一版先使用 `P50`。

## 页面改造清单

## 一、保留内容

以下信息仍然适合保留在 relay 详情页：

- Relay 名称
- `baseUrl`
- `websiteUrl`
- `supportedModelsCount`
- 起始价格：
  - `startingInputPricePer1M`
  - `startingOutputPricePer1M`
- 页面更新时间 `measuredAt`
- 模型支持列表

## 二、从主展示移除的内容

以下内容不再作为 relay 详情页主指标展示：

- relay 级 `healthStatus`
- relay 级 `availability24h`
- relay 级 `latencyP50Ms`
- relay 级 `latencyP95Ms`
- relay 级 30 天状态图
- relay 级 30 天延迟图

这些数据可以继续保留在内部聚合链路中，但不再面向用户作为主视图。

## 三、模型健康列表

模型支持列表升级为页面主内容，每模型一行展示：

- `modelName`
- `supportStatus`
- `currentStatus`
- `availability7d`
- `statusTrend7d`
- `latestLatencyP50Ms`
- `currentPrice`
- `lastVerifiedAt`

### 展示形式建议

- 桌面端：紧凑表格
- 移动端：紧凑卡片
- 当前状态使用强信号色
- 7 天趋势使用 7 个小状态块
- 延迟使用单个数字，不做额外小图

### 排序建议

列表排序优先级建议为：

1. 当前状态
2. 7 天可用性
3. 延迟
4. 模型名称

这样用户进入页面后能先看到最值得使用的模型。

## API 改造计划

## 一、新增接口

新增面向 relay 详情页的模型健康接口：

```txt
GET /public/relay/:slug/model-health?window=7d&region=global
```

建议第一版仅支持：

- `window=7d`
- `region=global`

后续如有必要再扩展。

## 二、返回结构建议

建议新增 shared schema：

```json
{
  "relay": {
    "slug": "vtok-ai",
    "name": "VTok.ai"
  },
  "window": "7d",
  "measuredAt": "2026-04-26T12:00:00Z",
  "rows": [
    {
      "modelKey": "gpt-5.4",
      "modelName": "gpt-5.4",
      "vendor": "gpt",
      "supportStatus": "active",
      "currentStatus": "healthy",
      "availability7d": 0.985,
      "latestLatencyP50Ms": 842,
      "statusTrend7d": [
        { "dateKey": "2026-04-20", "status": "healthy", "availability": 1 },
        { "dateKey": "2026-04-21", "status": "healthy", "availability": 1 }
      ],
      "currentPrice": {
        "currency": "USD",
        "inputPricePer1M": 2.5,
        "outputPricePer1M": 15
      },
      "lastVerifiedAt": "2026-04-26T11:55:00Z"
    }
  ]
}
```

## 三、后端数据来源

第一版不新增新表，直接基于现有聚合表和目录表组合：

- `relay_models`
- `relay_status_5m`
- `relay_latency_5m`
- `relay_prices`

其中：

- `currentStatus` 来自最新模型级状态聚合
- `availability7d` 来自 7 天窗口模型级状态汇总
- `statusTrend7d` 按天压缩成 7 个桶
- `latestLatencyP50Ms` 取最新模型级延迟
- `currentPrice` 取当前最新价格
- `lastVerifiedAt` 来自 `relay_models.last_verified_at`

## 四、兼容策略

第一版保留旧接口，不立即删除：

- `/public/relay/:slug/overview`
- `/public/relay/:slug/history`
- `/public/relay/:slug/models`
- `/public/relay/:slug/pricing-history`

前端 relay 详情页只是不再把 relay 级 `overview` 性能字段作为主展示。

## 前端改造计划

## 一、页面结构

当前页面由三块组成：

- `RelayHeroSection`
- `RelayHistorySection`
- `RelayModelSupportSection`

调整后建议变成：

- `RelayHeroSection`
  - 仅展示 relay 基础信息
- `RelayModelHealthSection`
  - 主内容，展示每模型健康列表
- 可选保留轻量说明区
  - 解释状态和价格口径

## 二、Hero 区域改造

`RelayHeroSection` 中删除 relay 级性能指标：

- 不再展示 `24h 可用性`
- 不再展示 `P50 延迟`
- 不再展示 `P95 延迟`

仅保留：

- Relay 名称
- 基础链接
- 支持模型数
- 起始价格
- 最近更新时间

## 三、模型健康组件

新增一个专用组件，建议命名：

- `RelayModelHealthSection`

职责：

- 拉取 `model-health` 数据
- 桌面端渲染紧凑表格
- 移动端渲染紧凑卡片
- 显示空态和加载态

建议额外增加一个小组件：

- `RelayModelStatusTrend`

用于渲染 7 天状态迷你条。

## 四、现有模型支持列表去向

当前 `RelayModelSupportSection` 已承载：

- 支持状态
- 支持能力
- 当前价格

本轮建议：

- 将其升级并重命名为 `RelayModelHealthSection`
- 支持能力标签如不影响可读性可保留
- 如果信息过密，第一版可以先不展示能力标签

## 文档同步计划

需要同步更新：

- `docs/API_CONTRACT_V1.md`
- `docs/ROUTES.md`
- `docs/ARCHITECTURE.md`

文档重点：

- relay 详情页改为模型健康看板
- relay 级性能字段不再是面向用户的主语义
- 新增 `model-health` 公共接口

## 验证计划

## 一、后端

- shared schema 测试
- 路由响应测试
- 多模型混合状态测试
- 无价格数据测试
- 无模型级聚合数据测试

## 二、前端

- relay 页加载和空态
- 桌面端紧凑表格
- 移动端紧凑卡片
- 状态迷你条渲染
- 类型检查和构建

## 执行顺序

建议按 3 个切片推进，并分别提交：

1. 文档切片
   - 落盘计划
   - 更新 API / routes / architecture 文档草案

2. API 切片
   - 新增 shared schema
   - 新增 `/public/relay/:slug/model-health`
   - 增加后端测试

3. Web 切片
   - relay 详情页改造
   - 移除 relay 级性能主展示
   - 渲染模型健康紧凑列表

## 验收标准

- relay 详情页不再将 relay 级延迟和可用性作为主指标
- 用户能在一个列表中看到每个模型的当前状态与 7 天可用性
- 用户无需再点入单独模型详情页就能完成基本判断
- 页面加载请求不出现按模型的前端 N+1 拉取
- 新接口和页面通过类型检查与既有测试
