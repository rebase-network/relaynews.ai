import * as Shared from "../../shared";

const {
  Panel,
  clsx,
  formatAvailability,
  formatDate,
  formatHealthStatusLabel,
  formatLatency,
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

  return (
    <section className="grid gap-4">
      <Panel
      >
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        {!error && loading ? <p className="text-sm text-black/60">正在加载模型健康信息...</p> : null}
        {!error && !loading && rows.length === 0 ? (
          <p className="text-sm text-black/60">这个站点当前还没有可展示的模型健康数据。</p>
        ) : null}
        {!error && !loading && rows.length > 0 ? (
          <>
            <div className="space-y-2.5 lg:hidden">
              {rows.map((row) => (
                <div key={row.modelKey} className="surface-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg tracking-[-0.03em]">{row.modelKey}</p>
                      <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-black/44">{row.vendor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-black/48">{formatHealthStatusLabel(row.currentStatus)}</p>
                      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-black/40">{formatSupportStatusLabel(row.supportStatus)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">7d 可用性</p>
                      <p className="mt-2 text-sm leading-5 text-black/78">{formatAvailabilityOrEmpty(row.availability7d)}</p>
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
                    </div>
                    <p className="text-xs leading-5 text-black/56">最近验证：{formatLastVerifiedAt(row.lastVerifiedAt)}</p>
                  </div>
                </div>
              ))}
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
                  {rows.map((row) => (
                    <tr key={row.modelKey} className="leaderboard-table-row align-top">
                      <td className="py-3 pr-3">
                        <p className="text-[0.98rem] leading-5 tracking-[-0.03em]">{row.modelKey}</p>
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
                      <td className="py-3 pr-3 text-sm text-black/76">{formatAvailabilityOrEmpty(row.availability7d)}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Panel>
    </section>
  );
}
