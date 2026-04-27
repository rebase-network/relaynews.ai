import * as Shared from "../../shared";

const {
  MetricGrid,
  Panel,
  clsx,
  formatAvailability,
  formatDate,
  formatHealthStatusLabel,
  formatLatency,
  formatModelDisplayName,
  formatPricePerMillion,
  formatSupportStatusLabel,
  getStatusToneClass,
} = Shared;

function formatAvailabilityOrEmpty(value: number | null) {
  return value === null ? "无样本" : formatAvailability(value);
}

function formatLastVerifiedAt(value: string | null) {
  return value ? `北京时间 ${Shared.formatDateTime(value)}` : "尚未验证";
}

function getTrendSampleCoverage(trend: Shared.RelayModelHealthRow["statusTrend7d"]) {
  const observedDays = trend.filter((point) => point.availability !== null && point.status !== "unknown").length;
  return {
    observedDays,
    totalDays: trend.length,
    label: `样本覆盖 ${observedDays}/${trend.length} 天`,
  };
}

function getLatestVerifiedAt(rows: Shared.RelayModelHealthRow[]) {
  const timestamps = rows
    .map((row) => row.lastVerifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return timestamps[0] ?? null;
}

function RelayModelStatusTrend({ trend }: { trend: Shared.RelayModelHealthRow["statusTrend7d"] }) {
  return (
    <div className="flex min-w-[7.75rem] items-center gap-1">
      {trend.map((point) => (
        <div
          key={point.dateKey}
          className={clsx("h-6 flex-1 rounded-[3px]", getStatusToneClass(point.status))}
          title={`${formatDate(`${point.dateKey}T00:00:00.000Z`)} · ${formatHealthStatusLabel(point.status)}${point.availability === null ? "" : ` · ${formatAvailability(point.availability)}`}`}
        />
      ))}
    </div>
  );
}

function RelayTrendLegend() {
  const items = [
    ["healthy", "健康"],
    ["degraded", "降级"],
    ["down", "不可用"],
    ["unknown", "无样本"],
  ] as const;

  return (
    <div className="relay-trend-legend" aria-label="7 天状态图例">
      {items.map(([status, label]) => (
        <span key={status} className="relay-trend-legend-item">
          <span className={clsx("h-2.5 w-2.5 rounded-full", getStatusToneClass(status))} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function RelayModelHealthSection({
  error,
  loading,
  modelHealth,
}: {
  error: string | null;
  loading: boolean;
  modelHealth: Shared.RelayModelHealthResponse | null;
}) {
  const rows = modelHealth?.rows ?? [];
  const healthyCount = rows.filter((row) => row.currentStatus === "healthy").length;
  const issueCount = rows.filter((row) => row.currentStatus !== "healthy").length;
  const latestVerifiedAt = getLatestVerifiedAt(rows);
  const observedCoverage = rows.reduce(
    (summary, row) => {
      const coverage = getTrendSampleCoverage(row.statusTrend7d);

      return {
        observed: summary.observed + coverage.observedDays,
        total: summary.total + coverage.totalDays,
      };
    },
    { observed: 0, total: 0 },
  );

  return (
    <section className="grid gap-4">
      <Panel
        kicker="7 天观测"
        title="支持模型健康概览"
        titleClassName="text-[2rem] md:text-[2.35rem]"
      >
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        {!error && loading ? <p className="text-sm text-black/60">正在加载模型健康信息...</p> : null}
        {!error && !loading && rows.length === 0 ? (
          <p className="text-sm text-black/60">这个站点当前还没有可展示的模型健康数据。</p>
        ) : null}
        {!error && !loading && rows.length > 0 ? (
          <>
            <p className="mb-4 max-w-3xl text-sm leading-6 text-black/64">
              下方只展示当前仍参与公开观测的模型。可用性为已观测样本口径，灰色状态代表无样本或未知。
            </p>
            <MetricGrid
              columnsClassName="grid-cols-2 xl:grid-cols-4"
              items={[
                {
                  label: "已观测模型",
                  value: rows.length,
                  valueClassName: "text-2xl",
                },
                {
                  label: "当前健康",
                  value: healthyCount,
                  valueClassName: "text-2xl",
                },
                {
                  label: "需关注",
                  value: issueCount,
                  valueClassName: "text-2xl",
                },
                {
                  label: "最近验证",
                  value: latestVerifiedAt ? formatLastVerifiedAt(latestVerifiedAt) : "尚未验证",
                  valueClassName: "text-sm leading-6",
                  valueTitle: latestVerifiedAt ?? "尚未验证",
                },
              ]}
            />
            <p className="mt-3 mb-4 text-xs leading-5 text-black/52">
              样本覆盖：{observedCoverage.observed}/{observedCoverage.total} 天观测窗口。
            </p>
            <RelayTrendLegend />
            <div className="space-y-2.5 lg:hidden">
              {rows.map((row) => {
                const coverage = getTrendSampleCoverage(row.statusTrend7d);
                const displayName = formatModelDisplayName(row.modelKey);

                return (
                <div key={row.modelKey} className="surface-card relay-model-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="relay-model-card-title" title={row.modelKey}>{displayName}</p>
                      <p className="relay-model-card-key">{row.modelKey}</p>
                      <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-black/44">{row.vendor}</p>
                      <div className="relay-model-status-line">
                        <span className="inline-flex items-center gap-2">
                          <span className={clsx("h-2.5 w-2.5 rounded-full", getStatusToneClass(row.currentStatus))} />
                          {formatHealthStatusLabel(row.currentStatus)} · {formatSupportStatusLabel(row.supportStatus)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">已观测可用性</p>
                      <p className="mt-2 text-sm leading-5 text-black/78">{formatAvailabilityOrEmpty(row.availability7d)}</p>
                      <p className="mt-1 text-[0.68rem] leading-5 text-black/48">{coverage.label}</p>
                    </div>
                    <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">P50 延迟</p>
                      <p className="mt-2 text-sm leading-5 text-black/78">{formatLatency(row.latestLatencyP50Ms)}</p>
                    </div>
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
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">7 天状态</p>
                      <div className="mt-2">
                        <RelayModelStatusTrend trend={row.statusTrend7d} />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-black/52">{coverage.observedDays < coverage.totalDays ? "灰色代表无样本或未知状态。" : coverage.label}</p>
                    </div>
                    <p className="text-xs leading-5 text-black/56">最近验证：{formatLastVerifiedAt(row.lastVerifiedAt)}</p>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="data-table hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="pb-2">模型</th>
                    <th className="w-[5rem] pb-2">状态</th>
                    <th className="w-[6.5rem] pb-2">7d 可用性</th>
                    <th className="w-[9rem] pb-2">7 天状态</th>
                    <th className="w-[5.5rem] pb-2">P50 延迟</th>
                    <th className="w-[5rem] pb-2 text-right">输入</th>
                    <th className="w-[5rem] pb-2 text-right">输出</th>
                    <th className="w-[10rem] pb-2 text-right">最近验证</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const coverage = getTrendSampleCoverage(row.statusTrend7d);

                    return (
                    <tr key={row.modelKey} className="leaderboard-table-row align-top">
                      <td className="py-3 pr-3">
                        <p className="text-[0.98rem] leading-5 tracking-[-0.03em]" title={row.modelKey}>
                          {formatModelDisplayName(row.modelKey)}
                        </p>
                        <p className="mt-1 break-all font-mono text-[0.58rem] uppercase tracking-[0.12em] text-black/36">
                          {row.modelKey}
                        </p>
                        <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-black/40">
                          {row.vendor} · {formatSupportStatusLabel(row.supportStatus)}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-[0.68rem] uppercase tracking-[0.16em] text-black/62">
                        <span className="inline-flex items-center gap-2">
                          <span className={clsx("h-2.5 w-2.5 rounded-full", getStatusToneClass(row.currentStatus))} />
                          {formatHealthStatusLabel(row.currentStatus)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-sm text-black/76">
                        <span>{formatAvailabilityOrEmpty(row.availability7d)}</span>
                        <span className="mt-1 block text-[0.68rem] leading-4 text-black/48">{coverage.label}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <RelayModelStatusTrend trend={row.statusTrend7d} />
                      </td>
                      <td className="py-3 pr-3 text-sm text-black/76">{formatLatency(row.latestLatencyP50Ms)}</td>
                      <td className="py-3 pr-3 text-right text-[0.92rem] font-medium tabular-nums">
                        {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                      </td>
                      <td className="py-3 pr-3 text-right text-[0.92rem] font-medium tabular-nums">
                        {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                      </td>
                      <td className="py-3 text-right text-xs leading-5 text-black/56">{formatLastVerifiedAt(row.lastVerifiedAt)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Panel>
    </section>
  );
}
