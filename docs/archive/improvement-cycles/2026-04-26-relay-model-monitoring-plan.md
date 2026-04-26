# 2026-04-26 Relay × Model 定时监控改造计划

## 背景

当前定时监控链路的调度粒度仍然偏向 `relay credential -> single test_model`。

虽然系统已经具备模型级聚合能力：

- `probe_results_raw.model_id`
- `relay_status_5m.model_id`
- `relay_latency_5m.model_id`
- `relay_score_hourly.model_id`

但实际定时任务执行时，仍然是：

- 从 `probe_credentials` 读取一个 `test_model`
- 对该 relay 发起一次 probe
- 将这一次 probe 结果写入：
  - relay 级聚合 (`model_id is null`)
  - 如果能解析出模型，则再写一份单模型聚合

这会导致一个结构性问题：

- 一个 relay 虽然支持多个模型
- 但只有被 `test_model` 选中的那个模型会持续获得新鲜模型级数据
- 其他模型即使存在于 `relay_models` 中，也可能长期没有最新可用性与延迟信号

随着 relay 详情页改为“模型健康看板”，这种数据覆盖问题会直接暴露给用户。

因此，调度层需要从“单模型 credential 监控”升级为真正的 `relay × model` 监控。

## 改造目标

- 将定时任务的调度粒度改为 `active relay credential × active relay model`
- 让模型级状态、可用性、延迟成为主监控结果来源
- 让每个 relay 下被纳入监控的模型都能获得持续更新的数据
- 将 `probe_credentials` 从“定义测哪个模型”改成“定义用什么 key / 默认协议去测”
- 将 `relay_models` 升级为“模型监控目标配置表”

## 核心原则

### 1. credential 只负责认证，不再决定唯一监控模型

`probe_credentials` 应继续作为 relay 认证和默认兼容模式配置来源。

但它不再应被视为：

- 唯一监控模型定义
- 唯一调度目标来源

`test_model` 可以保留为兼容字段，但不再作为定时监控主输入。

### 2. relay_models 成为监控目标集合

`relay_models` 应成为真正的模型监控目标表，决定：

- 哪些模型需要进入调度
- 哪些模型优先级更高
- 哪些模型需要协议覆盖
- 最近一次模型级探测结果是什么

### 3. 模型级结果优先，relay 级结果降级

未来面向用户的监控结果应以模型级聚合为主。

relay 级聚合可以继续保留给：

- 内部运维
- 粗粒度健康信号
- 旧接口兼容

但不再是产品语义的主来源。

## 数据结构调整

## 一、probe_credentials

保留现有字段：

- `relay_id`
- `api_key`
- `compatibility_mode`
- `status`
- `last_verified_at`
- `last_probe_ok`
- `last_health_status`
- `last_http_status`
- `last_message`
- `last_detection_mode`
- `last_used_url`

字段语义调整：

- `test_model`
  - 从“定时监控模型”降级为：
    - 提交审核初始测试默认模型
    - relay 初始化阶段的默认模型
    - 无模型映射时的兜底值

不建议第一版删除该字段，以降低迁移和兼容风险。

## 二、relay_models

建议新增字段：

- `monitoring_enabled boolean not null default true`
- `monitoring_priority integer not null default 100`
- `compatibility_mode_override text null`
- `last_compatibility_mode text null`
- `last_probe_ok boolean null`
- `last_health_status text null`
- `last_http_status integer null`
- `last_message text null`
- `last_detection_mode text null`
- `last_used_url text null`

建议含义：

- `monitoring_enabled`
  - 是否纳入定时任务
- `monitoring_priority`
  - 用于预算控制时排序
- `compatibility_mode_override`
  - 单模型协议强制覆盖
- `last_compatibility_mode`
  - 最近一次成功模型级探测的协议模式
- 其余 `last_*`
  - 最近一次模型级直接探测结果快照

## 三、为什么先不加新表

第一版不建议引入单独的 `relay_monitor_targets` 表。

原因：

- `relay_models` 已经天然表达了 relay 与模型的支持关系
- 监控目标与模型支持本身高度重合
- 只需补监控字段即可落地，不需要额外归一层

后续如果监控策略复杂化，再考虑引入独立 target 表。

## 调度逻辑调整

## 一、新的监控目标定义

新增内部概念：`monitor target`

建议结构：

- `credentialId`
- `relayId`
- `relaySlug`
- `relayName`
- `baseUrl`
- `apiKey`
- `modelId`
- `modelKey`
- `remoteModelName`
- `compatibilityMode`

生成来源：

- `probe_credentials.status = 'active'`
- `relays.status = 'active'`
- `relay_models.status in ('active', 'degraded', 'pending')`
- `relay_models.monitoring_enabled = true`

## 二、请求模型名优先级

每个 target 发起 probe 时，模型名建议按以下优先级取值：

1. `relay_models.remote_model_name`
2. `models.key`
3. `probe_credentials.test_model` 兜底

原因：

- `remote_model_name` 更接近上游真实模型名
- `models.key` 是系统 canonical key
- `test_model` 应只作为兼容 fallback

## 三、兼容模式优先级

每个 target 发起 probe 时，兼容模式优先级建议为：

1. `relay_models.compatibility_mode_override`
2. `relay_models.last_compatibility_mode`
3. `probe_credentials.compatibility_mode`
4. `auto`

这样可以把协议缓存从 relay 级下沉到模型级。

## 四、runRelayMonitoringCycle 重构方向

当前 `runRelayMonitoringCycle` 的结构需要改成：

1. `loadRelayMonitoringTargets`
2. 对每个 target 执行 `runRelayModelMonitoring`
3. 持久化模型级原始 probe 结果与聚合
4. 批量刷新 public snapshots

建议拆分的新函数：

- `loadRelayMonitoringTargets`
- `runRelayModelMonitoring`
- `persistRelayModelMonitoringProbe`
- `refreshModelScopeAggregates`

## 持久化规则

## 一、原始结果

每个模型级 probe 均写入：

- `probe_results_raw`

并明确带上：

- `relay_id`
- `model_id`
- `response_model_name`
- 延迟 / TTFB / first token

## 二、模型级聚合

每个模型级 probe 刷新：

- `relay_status_5m (model_id = target.modelId)`
- `relay_latency_5m (model_id = target.modelId)`
- `relay_score_hourly (model_id = target.modelId)`

这是未来 public relay detail 和 leaderboard 的主来源。

## 三、relay_models 最近结果

每次模型级 probe 完成后，同步更新 `relay_models`：

- `last_verified_at`
- `status`
- `last_probe_ok`
- `last_health_status`
- `last_http_status`
- `last_message`
- `last_detection_mode`
- `last_used_url`
- `last_compatibility_mode`

这样 relay detail 页可以快速拿到“这个模型最近一次直接探测结果”。

## relay 级聚合策略

## 一、第一版建议

第一版可以继续保留 relay 级聚合写入，以兼容现有 overview 和内部流程。

但这类 relay 级聚合应被明确视为：

- 过渡兼容层
- 内部运维辅助信号

而不是未来公共页面的主数据来源。

## 二、后续建议

后续如果需要保留 relay 级状态，可改为从模型级结果派生。

也就是：

- 不再直接把某一次单模型 probe 写成 relay 级权威结果
- 而是从同一 relay 下多个模型的最新结果汇总出 relay 级综合状态

这一步建议在模型级调度稳定后再做。

## 调度预算控制

这是第一版必须显式设计的部分。

如果一个 relay 支持 10 个模型，且全部每 15 分钟探测一次，调度量会快速放大。

### 建议新增配置

- `MONITORING_MAX_MODELS_PER_RELAY`
- `MONITORING_FAILURE_BACKOFF_THRESHOLD`
- `MONITORING_FAILURE_BACKOFF_MINUTES`

### 第一版默认策略

- 每个 relay 每轮最多探测 `3` 个模型
- 排序规则：
  1. `monitoring_priority` 升序
  2. `relay_models.status = active` 优先
  3. 最近 24h 有样本的模型优先
  4. canonical 核心榜单模型优先

### 连续失败降频

建议：

- 某模型连续失败达到阈值后，进入回退期
- 回退期内降低优先级或临时跳过

这样能避免少数异常模型吞掉调度预算。

## 管理端后续支持

第一版可不立即改 admin UI，但需要预留方向。

后续 admin 需要支持：

- 开关 `monitoring_enabled`
- 编辑 `monitoring_priority`
- 设置 `compatibility_mode_override`
- 查看模型级最近探测结果

## 分阶段实施计划

## Phase A：数据库迁移

目标：

- 给 `relay_models` 增加监控配置与最近探测结果字段

产出：

- 新 migration
- `docs/DATABASE_SCHEMA.md` 更新

## Phase B：API / 调度重构

目标：

- 新增 target 生成逻辑
- 让定时任务按 `relay × model` 跑
- 让模型级聚合成为主要数据来源

产出：

- `runRelayMonitoringCycle` 重构
- 新 helper / tests

## Phase C：快照与 public 读模型对齐

目标：

- 确认 leaderboard 和 relay detail 读取的是模型级数据
- 只保留最小 relay 级兼容层

## Phase D：管理端增强

目标：

- 允许运营手动调控模型监控开关和优先级

这一阶段可晚于前 3 阶段。

## 测试要求

后端至少新增：

- target 生成测试
- 预算截断测试
- 模型级持久化测试
- 兼容模式优先级测试
- 连续失败降频测试

同时回归验证：

- `relay_score_hourly` 模型级行是否持续生成
- `relay detail model-health` 是否能覆盖更多模型
- leaderboard snapshot 是否随着模型级监控变得更完整

## 第一版边界

第一版建议只做：

- `relay_models` 新增监控字段
- 定时任务改成 `relay × model`
- 每 relay 每轮最多探测 3 个模型
- 模型级聚合成为主来源
- relay 级聚合先兼容保留

不做：

- 新建独立 target 表
- 新建复杂调度队列
- 全量无限制模型探测
- 前台额外暴露 relay 级综合状态说明

## 验收标准

- 定时任务不再只依赖 `probe_credentials.test_model`
- 同一 relay 下多个模型能获得独立的模型级延迟和状态数据
- `relay detail` 的模型健康看板不再长期大面积 `unknown`
- 调度量在预算范围内可控
- 系统仍能顺利刷新 public snapshots
