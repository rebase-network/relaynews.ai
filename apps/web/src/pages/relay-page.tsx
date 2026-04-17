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

export function RelayPage() {
  const { slug = "aurora-relay" } = useParams();
  const overview = useLoadable<Shared.RelayOverviewResponse>(
    `/public/relay/${slug}/overview`,
    () => fetchJson(`/public/relay/${slug}/overview`),
    [slug],
  );
  const history = useLoadable<Shared.RelayHistoryResponse>(
    `/public/relay/${slug}/history?window=30d`,
    () => fetchJson(`/public/relay/${slug}/history?window=30d`),
    [slug],
  );
  const models = useLoadable<Shared.RelayModelsResponse>(
    `/public/relay/${slug}/models`,
    () => fetchJson(`/public/relay/${slug}/models`),
    [slug],
  );
  const pricing = useLoadable<Shared.RelayPricingHistoryResponse>(
    `/public/relay/${slug}/pricing-history`,
    () => fetchJson(`/public/relay/${slug}/pricing-history`),
    [slug],
  );
  const relayName = overview.data?.relay.name ?? slug;
  usePageMetadata({
    title: `${relayName} Relay 详情｜relaynew.ai`,
    description:
      overview.data
        ? `查看 ${overview.data.relay.name} 的 24h 可用性、延迟走势、模型支持与当前价格。`
        : "查看站点的 24h 可用性、延迟走势、模型支持与当前价格。",
  });
  if (overview.loading) return <RelayPageSkeleton />;
  if (overview.error || !overview.data) return <ErrorPanel message={overview.error ?? "Relay 详情加载失败。"} />;

  const snapshotMetrics = [
    { label: "24h 可用性", value: formatAvailability(overview.data.availability24h) },
    { label: "P50 延迟", value: formatLatency(overview.data.latencyP50Ms) },
    { label: "P95 延迟", value: formatLatency(overview.data.latencyP95Ms) },
    { label: "模型数", value: overview.data.supportedModelsCount },
  ];

  const latestPricingByModelKey = new Map<string, Shared.RelayPricingHistoryResponse["rows"][number]>();
  if (pricing.data) {
    for (const row of pricing.data.rows) {
      if (!latestPricingByModelKey.has(row.modelKey)) {
        latestPricingByModelKey.set(row.modelKey, row);
      }
    }
  }

  const modelPricingRows: Shared.RelayModelPricingRow[] = models.data?.rows.map((row) => ({
    ...row,
    currentPrice: latestPricingByModelKey.get(row.modelKey) ?? null,
  })) ?? [];
  const modelRowsPerColumn = Math.ceil(modelPricingRows.length / 2);
  const modelTableColumns: Array<Array<Shared.RelayModelPricingRow | null>> = [
    modelPricingRows.slice(0, modelRowsPerColumn),
    modelPricingRows.slice(modelRowsPerColumn),
  ]
    .filter((rows) => rows.length > 0)
    .map((rows) => [...rows, ...Array.from({ length: Math.max(0, modelRowsPerColumn - rows.length) }, () => null)]);
  const historySlots = history.data ? buildDailyHistorySlots(history.data.points, history.data.measuredAt) : [];
  const measuredHistorySlotCount = historySlots.filter((slot) => slot.point).length;
  const latestMeasuredHistoryPoint = [...historySlots].reverse().find((slot) => slot.point?.latencyP95Ms !== null)?.point ?? null;

  return (
    <div className="space-y-4">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <p className="kicker">Relay 详情</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.16em]">
              <span className="inline-flex items-center gap-2">
                <StatusDot status={overview.data.healthStatus} />
                {formatHealthStatusLabel(overview.data.healthStatus)}
              </span>
              <span className="text-black/46">北京时间 {formatProbeMeasuredAt(overview.data.measuredAt)}</span>
            </div>
            <div>
              <h1 className="text-4xl leading-[0.92] tracking-[-0.06em] md:text-[4.2rem]">{overview.data.relay.name}</h1>
              <p className="mt-2 break-all font-mono text-[0.8rem] text-black/62">{overview.data.relay.baseUrl}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-black/72">
                {HEALTH_STATUS_COPY[overview.data.healthStatus] ?? "这个站点的近期证据仍在持续积累中。"}
              </p>
            </div>
            {overview.data.relay.websiteUrl ? (
              <div className="flex flex-wrap gap-2">
                <a
                  className="signal-chip"
                  href={overview.data.relay.websiteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  访问官网
                </a>
              </div>
            ) : null}
          </div>
          <ScorePopover scoreSummary={overview.data.scoreSummary} />
        </div>
        <div className="mt-4">
          <MetricGrid
            columnsClassName="grid-cols-2 lg:grid-cols-4"
            items={snapshotMetrics.map((item) => ({
              ...item,
              cardClassName: "probe-metric-card",
              valueClassName: "text-[1.32rem] leading-[1.05]",
              valueSpacingClassName: "mt-2.5",
            }))}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          className="h-full"
          title="延迟"
          kicker="近 30 天走势"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {history.error ? (
            <p className="text-sm text-[#b42318]">{history.error}</p>
          ) : history.loading || !history.data ? <p className="text-sm text-black/60">正在加载趋势...</p> : (
            <div className="space-y-3">
              <RelayLatencyChart slots={historySlots} />
              <RelayLatencyLegend />
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">窗口</p>
                  <p className="mt-2 text-black/76">30d</p>
                </div>
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">覆盖度</p>
                  <p className="mt-2 text-black/76">{measuredHistorySlotCount} / 30 天</p>
                </div>
                <div className="surface-card px-3 py-2.5 text-sm">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新 P95</p>
                  <p className="mt-2 text-black/76">
                    {formatLatency(latestMeasuredHistoryPoint?.latencyP95Ms ?? null)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <Panel
          className="h-full"
          title="状态"
          kicker="近 30 天可用性"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {history.error ? (
            <p className="text-sm text-[#b42318]">{history.error}</p>
          ) : history.loading || !history.data ? (
            <p className="text-sm text-black/60">正在加载状态...</p>
          ) : (
            <StatusHistoryPanel slots={historySlots} />
          )}
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel
          title="模型支持"
          kicker="当前价格"
          headerClassName="mb-3"
          titleClassName="text-[2.2rem] md:text-[2.45rem]"
        >
          {models.loading || !models.data ? <p className="text-sm text-black/60">正在加载模型...</p> : (
            modelPricingRows.length === 0 ? <p className="text-sm text-black/60">这个站点还没有公开模型信息。</p> : (
            <>
              <div className="space-y-2.5 lg:hidden">
                {modelPricingRows.map((row) => (
                  <div key={row.modelKey} className="surface-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg tracking-[-0.03em]">{row.modelName}</p>
                        <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-black/44">{row.vendor}</p>
                      </div>
                      <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/50">{formatSupportStatusLabel(row.supportStatus)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输入 / 1M</p>
                        <p className="mt-2 text-sm leading-5 text-black/78">
                          {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                        </p>
                      </div>
                      <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输出 / 1M</p>
                        <p className="mt-2 text-sm leading-5 text-black/78">
                          {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 xl:gap-4">
                {modelTableColumns.map((rows, index) => (
                  <RelayModelsTable key={index} rows={rows} />
                ))}
              </div>
            </>
            )
          )}
        </Panel>
      </section>
    </div>
  );
}
