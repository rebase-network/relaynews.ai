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

export function HomePage() {
  const { data, loading, error } = useLoadable<Shared.HomeSummaryResponse>(
    "/public/home-summary",
    () => fetchJson("/public/home-summary"),
    [],
  );
  const quickProbe = useProbeController(DEFAULT_PROBE_STATE);
  usePageMetadata({
    title: "relaynew.ai｜大模型API服务站监控、榜单与测试",
    description: "面向中国用户的大模型API服务站目录与评测平台，提供站点榜单、API 测试与站点提交入口。",
  });

  if (loading) return <HomePageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "首页加载失败。"} />;

  return (
    <div className="space-y-5">
      <section className="panel hero-panel home-hero-panel min-h-0">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_24rem] xl:items-start">
          <div className="home-hero-copy">
            <p className="kicker !mb-3 !text-black/60">公开目录与实测榜单</p>
            <h1 className="max-w-4xl text-[2.55rem] leading-[0.96] tracking-[-0.045em] md:text-5xl md:leading-[0.92] md:tracking-[-0.07em] xl:text-[3.6rem]">
              发现优质AI服务商，快速测试API，建立公开目录
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-black/72 md:mt-4 md:text-base md:leading-7">
              你可以先浏览模型目录，再进入具体榜单比较站点表现；也可以直接快速检测站点。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/leaderboard">查看目录</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
              <Link className="button-cream" to="/submit">提交站点</Link>
            </div>
            <div className="home-hero-metrics">
              <div className="home-hero-metric">
                <p className="home-hero-metric-label">已收录站点</p>
                <p className="home-hero-metric-value">{data.hero.totalRelays}</p>
              </div>
              <div className="home-hero-metric">
                <p className="home-hero-metric-label">健康站点</p>
                <p className="home-hero-metric-value">{data.hero.healthyRelays}</p>
              </div>
              <div className="home-hero-metric">
                <p className="home-hero-metric-label">最近快照</p>
                <p className="home-hero-metric-value home-hero-metric-value-sm">{formatDateTime(data.hero.measuredAt)}</p>
              </div>
            </div>
          </div>
          <aside className="home-hero-probe">
            <form className="quick-probe-card quick-probe-form" noValidate onSubmit={quickProbe.handleSubmit}>
              <div className="quick-probe-header">
                <div>
                  <p className="quick-probe-heading">快速测试</p>
                </div>
                <Link
                  aria-label="打开完整测试页"
                  className="quick-probe-link"
                  title="打开完整测试页"
                  to="/probe"
                >
                  完整测试
                </Link>
              </div>
              <ProbeFormFields
                compact
                errors={quickProbe.errors}
                setState={quickProbe.setState}
                showHelpers={false}
                state={quickProbe.state}
              />
              <div className="quick-probe-footer">
                <InlineProbeSummary
                  error={quickProbe.error}
                  result={quickProbe.result}
                  resultTone={quickProbe.resultTone}
                />
                <button className="button-dark quick-probe-action" disabled={quickProbe.submitting} type="submit">
                  {quickProbe.submitting ? "检测中..." : "立即测试"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      </section>

      <Panel className="home-leaderboard-panel">
        <div className="home-section-header">
          <div>
            <p className="kicker !mb-1">模型榜单预览</p>
            <p className="max-w-2xl text-sm leading-6 text-black/66">
              按主流模型分类展示最新实测结果，每个分类保留当前评分靠前的站点预览。
            </p>
          </div>
          <Link className="button-cream" to={LEADERBOARD_DIRECTORY_PATH}>
            查看全部模型
          </Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.leaderboards.map((board) => (
            <LeaderboardPreviewCard
              key={board.modelKey}
              board={board}
              rowLimit={HOME_LEADERBOARD_ROW_LIMIT}
            />
          ))}
        </div>
      </Panel>

      <section className="home-bridge">
        <p className="home-bridge-copy">
          评测是基于多个维度对站点服务质量进行自动化测试，赞助并不影响评测，会有单独的赞助方展示，力求评测公开公正
        </p>
        <div className="home-bridge-actions">
          <Link className="home-bridge-link" to="/methodology">
            评测方式
          </Link>
          <Link className="home-bridge-link" to="/methodology#governance">
            我们怎么做
          </Link>
        </div>
      </section>

      {data.highlights.length > 0 ? (
        <section className="panel">
          <div className="home-section-header">
            <div>
              <p className="kicker !mb-1">赞助商</p>
              <p className="text-sm leading-6 text-black/66">独立展示，不参与榜单排序。</p>
            </div>
          </div>
          <div className={clsx("grid gap-3", data.highlights.length > 1 && "lg:grid-cols-2")}>
            {data.highlights.map((relay) => (
              <Link
                key={relay.slug}
                to={`/relay/${relay.slug}`}
                className="surface-link home-sponsor-card"
              >
                <div className="min-w-0">
                  <p className="home-sponsor-label">赞助展示</p>
                  <p className="home-sponsor-name">{relay.name}</p>
                  <p className="home-sponsor-copy">商业合作位，独立展示，不参与评分或榜单排序。</p>
                </div>
                <div className="home-sponsor-action">
                  查看站点资料
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
