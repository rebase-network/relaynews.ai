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

export function MethodologyPage() {
  const { data, loading, error } = useLoadable<Shared.MethodologyResponse>(
    "/public/methodology",
    () => fetchJson("/public/methodology"),
    [],
  );
  usePageMetadata({
    title: "站点评测方式｜relaynew.ai",
    description: "解释站点评分构成、健康状态定义、徽章含义与榜单阅读方式，帮助运营和用户理解评测依据。",
    canonicalPath: "/methodology",
  });
  if (loading) return <MethodologyPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "评测方式页面加载失败。"} />;

  return (
    <div className="space-y-5">
      <section className="panel methodology-hero bg-[#fff0c2]">
        <p className="kicker">评测方式</p>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
          <div className="methodology-hero-copy">
            <h1 className="max-w-3xl text-[2.55rem] leading-[0.94] tracking-[-0.05em] md:text-[3.05rem]">
              我们如何测试并评估站点服务质量。
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-black/70">
              评测综合五项公开信号：可用性、延迟、一致性、性价比与稳定性。
              赞助方展示不会并入评分，因此榜单排序始终只看测试结果。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/policy">我们如何评估</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
            </div>
            <p className="methodology-hero-meta">
              快照时间：北京时间 {formatDateTime(data.measuredAt)}
            </p>
          </div>
          <div className="surface-card methodology-weight-card">
            <p className="kicker">当前评分构成</p>
            <div className="methodology-weight-list">
              {Object.entries(data.weights).map(([label, value]) => (
                <div key={label} className="methodology-weight-row">
                  <div className="methodology-weight-head">
                    <p className="methodology-weight-label">{formatScoreMetricLabel(label as keyof Shared.RelayOverviewResponse["scoreSummary"])}</p>
                    <p className="methodology-weight-value">{value}%</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/55">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffd900,#fa520f)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <Panel title="公开状态说明" className="methodology-section-panel">
          <div className="methodology-status-list">
            {data.healthStatuses.map((status) => (
              <div key={status} className="methodology-status-row">
                <div className="methodology-status-head">
                  <StatusDot status={status} /> {formatHealthStatusLabel(status)}
                </div>
                <p className="methodology-status-copy">
                  {HEALTH_STATUS_COPY[status] ?? "公开状态文案基于最近一次的实测证据生成。"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="徽章含义" className="methodology-section-panel">
          <div className="methodology-badge-grid">
            {data.badges.map((badge) => (
              <div key={badge} className="methodology-badge-row">
                <span className="signal-chip">{formatBadgeLabel(badge)}</span>
                <p className="methodology-badge-copy">
                  {BADGE_COPY[badge] ?? "这个徽章用于解释当前的置信度、性价比或运行状态。"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
