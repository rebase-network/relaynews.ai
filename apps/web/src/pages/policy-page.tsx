import * as Shared from "../shared";

const {
  clsx,
  useEffect,
  useMemo,
  useNavigate,
  useParams,
  useSearchParams,
  useState,
  BADGE_COPY,
  DEFAULT_LEADERBOARD_MODEL_KEY,
  DEFAULT_PROBE_STATE,
  ErrorPanel,
  HEALTH_STATUS_COPY,
  HOME_LEADERBOARD_ROW_LIMIT,
  HomeIncidentCard,
  HomePageSkeleton,
  InlineProbeSummary,
  LEADERBOARD_DIRECTORY_PATH,
  LeaderboardDirectorySkeleton,
  LeaderboardPageSkeleton,
  LeaderboardPreviewCard,
  LeaderboardRowCard,
  CompactBadgeList,
  Link,
  LoadingPanel,
  MetricGrid,
  MethodologyPageSkeleton,
  NavLink,
  Panel,
  POLICY_PILLARS,
  ProbeFormFields,
  PROBE_COMPATIBILITY_OPTIONS,
  PROBE_OUTPUT_CARDS,
  RelayIncidentTimeline,
  RelayLatencyChart,
  RelayLatencyLegend,
  RelayModelsTable,
  RelayPageSkeleton,
  RelayPricingHistoryPanel,
  ScorePopover,
  StatusDot,
  StatusHistoryPanel,
  buildDailyHistorySlots,
  createSubmitModelPriceRow,
  fetchJson,
  formatAvailability,
  formatBadgeLabel,
  formatDate,
  formatDateTime,
  formatHealthStatusLabel,
  formatIncidentSeverityLabel,
  formatLatency,
  formatPricePerMillion,
  formatPricingSourceLabel,
  formatProbeCompatibilityMode,
  formatProbeDetectionMode,
  formatProbeHttpStatus,
  formatProbeMeasuredAt,
  formatScoreMetricLabel,
  formatSupportStatusLabel,
  getConnectivityCardTone,
  getIncidentToneClasses,
  getLeaderboardPath,
  getModelVendorKey,
  getModelVendorLabel,
  getProbeStateFromSearchParams,
  getProtocolCardTone,
  getTraceCardTone,
  isValidHttpUrl,
  useLoadable,
  usePageMetadata,
  useProbeController,
  validateSubmitForm,
} = Shared;

export function PolicyPage() {
  usePageMetadata({
    title: "我们怎么做｜relaynew.ai",
    description: "说明站点收录与评测边界、赞助方展示规则，以及运营者纠错申诉与复核流程。",
    canonicalPath: "/policy",
  });

  return (
    <div className="space-y-5">
      <section className="panel policy-hero bg-[#fff0c2]">
        <p className="kicker">我们怎么做</p>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] xl:items-start">
          <div className="policy-hero-copy">
            <h1 className="max-w-3xl text-[2.55rem] leading-[0.94] tracking-[-0.05em] md:text-[3rem]">
              目录保持中立、可观测，并支持运营者申诉与复核。
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-black/70">
              这里会解释哪些决策由测量结果驱动，哪些属于运营或编辑判断，以及运营者如何修正收录信息。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/submit">提交站点</Link>
              <Link className="button-cream" to="/methodology">查看评测方式</Link>
            </div>
          </div>
          <div className="policy-pillars-grid">
            {POLICY_PILLARS.map((pillar) => (
              <div key={pillar.title} className="policy-pillar">
                <p className="policy-pillar-title">{pillar.title}</p>
                <p className="policy-pillar-copy">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="哪些因素会影响榜单顺序" kicker="测量输入" className="policy-compare-panel">
          <div className="policy-list">
            <div className="policy-list-row">实测可用性，以及请求成功的连续性表现。</div>
            <div className="policy-list-row">特定模型分类下的延迟分布与近期一致性。</div>
            <div className="policy-list-row">相对同类站点的价格效率与性价比。</div>
            <div className="policy-list-row">稳定性信号、事故新鲜度，以及样本量带来的置信度。</div>
          </div>
        </Panel>
        <Panel title="哪些因素不会改变评测排名" kicker="边界说明" className="policy-compare-panel">
          <div className="policy-list">
            <div className="policy-list-row">赞助套餐、合作露出或其他推广展示。</div>
            <div className="policy-list-row">缺乏测量变化支撑的人工调位请求。</div>
            <div className="policy-list-row">无法复现、也没有最新证据支撑的单次 anecdote。</div>
            <div className="policy-list-row">单独一次测试成功本身；公开测试用于诊断连通性，不直接定义排名。</div>
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="运营者复核路径" kicker="纠错与申诉" className="policy-process-panel">
          <div className="policy-step-list">
            <div className="policy-step-row">
              <span className="policy-step-index">01</span>
              <p className="policy-step-copy">如果站点端点、支持模型或公开信息发生变化，请重新提交最新资料。</p>
            </div>
            <div className="policy-step-row">
              <span className="policy-step-index">02</span>
              <p className="policy-step-copy">如果你认为公开状态不准确，请提供可复现的测试数据、受影响模型与时间窗口。</p>
            </div>
            <div className="policy-step-row">
              <span className="policy-step-index">03</span>
              <p className="policy-step-copy">补充证据期间，条目可能会暂停或标记为观察中，但赞助展示与评测排名仍保持分离。</p>
            </div>
          </div>
        </Panel>
        <Panel title="建议的运营动作顺序" kicker="实践流程" className="policy-process-panel">
          <div className="policy-sequence-grid">
            <div className="policy-sequence-step">
              <span className="policy-step-index">1</span>
              <p className="policy-step-copy">先用受限测试验证公开路由、API 协议族和模型行为是否正常。</p>
            </div>
            <div className="policy-sequence-step">
              <span className="policy-step-index">2</span>
              <p className="policy-step-copy">再提交规范的 URL、运营者联系信息与必要说明。</p>
            </div>
            <div className="policy-sequence-step">
              <span className="policy-step-index">3</span>
              <p className="policy-step-copy">最后持续观察公开榜单、状态变化与备注说明。</p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
