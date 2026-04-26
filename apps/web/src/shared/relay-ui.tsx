import { useRef } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import * as Shared from "../shared-base";

const {
  clsx,
  formatAvailability,
  formatDate,
  formatDateTime,
  formatHealthStatusLabel,
  formatIncidentSeverityLabel,
  formatLatency,
  formatPricePerMillion,
  formatPricingSourceLabel,
  formatScoreMetricLabel,
  formatSupportStatusLabel,
  getAvailabilityTrendStatus,
  getIncidentToneClasses,
  getLatencyToneColor,
  getStatusToneColor,
  useEffect,
  useState,
} = Shared;

export type HistoryChartDatum = {
  dateKey: string;
  displayDate: string;
  value: number;
  fill: string;
  barTestId: string;
  tooltipValue: string;
  tooltipMeta?: string;
};

export function HistoryChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryChartDatum }>;
}) {
  const datum = payload?.[0]?.payload;

  if (!active || !datum) {
    return null;
  }

  return (
    <div className="surface-card min-w-[10rem] px-3 py-2.5 shadow-[rgba(127,99,21,0.16)_0_12px_28px]">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">{datum.displayDate}</p>
      <p className="mt-2 text-sm text-black/78">{datum.tooltipValue}</p>
      {datum.tooltipMeta ? <p className="mt-1 text-xs text-black/56">{datum.tooltipMeta}</p> : null}
    </div>
  );
}

export function TimelineBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = "#d4d4d8",
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: HistoryChartDatum;
}) {
  return (
    <rect
      data-testid={payload?.barTestId}
      fill={fill}
      height={Math.max(height, 1)}
      rx={1}
      ry={1}
      width={Math.max(width, 1)}
      x={x}
      y={y}
    />
  );
}

export function RelayLatencyChart({ slots }: { slots: Shared.DailyHistorySlot[] }) {
  const domainMax = Math.max(...slots.map((slot) => slot.point?.latencyP95Ms ?? 0), 4000);
  const missingBarValue = Math.max(80, Math.round(domainMax * 0.03));
  const data: HistoryChartDatum[] = slots.map((slot) => {
    const latencyMs = slot.point?.latencyP95Ms ?? null;
    const datum = {
      dateKey: slot.dateKey,
      displayDate: formatDate(`${slot.dateKey}T00:00:00.000Z`),
      value: latencyMs ?? missingBarValue,
      fill: getLatencyToneColor(latencyMs),
      barTestId: "relay-latency-bar",
      tooltipValue: latencyMs === null ? "暂无延迟样本" : `P95 ${formatLatency(latencyMs)}`,
    };

    return latencyMs === null
      ? datum
      : {
          ...datum,
          tooltipMeta: `档位 ${latencyMs < 1000 ? "<1s" : latencyMs < 2000 ? "1-2s" : latencyMs < 4000 ? "2-4s" : "4s+"}`,
        };
  });

  return (
    <div data-testid="relay-latency-chart" className="h-24 md:h-28">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart barCategoryGap="20%" data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<HistoryChartTooltip />} cursor={false} />
          <Bar dataKey="value" isAnimationActive={false} minPointSize={8} shape={<TimelineBarShape />}>
            {data.map((entry) => (
              <Cell key={entry.dateKey} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RelayLatencyLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.64rem] uppercase tracking-[0.16em] text-black/48">
      {[
        { label: "<1s", toneClassName: "bg-emerald-500" },
        { label: "1-2s", toneClassName: "bg-yellow-400" },
        { label: "2-4s", toneClassName: "bg-orange-500" },
        { label: "4s+", toneClassName: "bg-red-500" },
        { label: "无样本", toneClassName: "bg-zinc-300" },
      ].map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={clsx("h-2 w-2 rounded-full", item.toneClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function RelayStatusChart({ slots }: { slots: Shared.DailyHistorySlot[] }) {
  const data: HistoryChartDatum[] = slots.map((slot) => {
    const status = slot.point ? getAvailabilityTrendStatus(slot.point.availability) : "unknown";
    const datum = {
      dateKey: slot.dateKey,
      displayDate: formatDate(`${slot.dateKey}T00:00:00.000Z`),
      value: 100,
      fill: getStatusToneColor(status),
      barTestId: "relay-status-bar",
      tooltipValue: slot.point ? formatHealthStatusLabel(status) : "无样本",
    };

    return slot.point
      ? {
          ...datum,
          tooltipMeta: formatAvailability(slot.point.availability),
        }
      : datum;
  });

  return (
    <div data-testid="relay-status-chart" className="h-24 md:h-28">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart barCategoryGap="20%" data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<HistoryChartTooltip />} cursor={false} />
          <Bar dataKey="value" isAnimationActive={false} shape={<TimelineBarShape />}>
            {data.map((entry) => (
              <Cell key={entry.dateKey} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RelayStatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.64rem] uppercase tracking-[0.16em] text-black/48">
      {[
        { label: "稳定", toneClassName: "bg-emerald-500" },
        { label: "降级", toneClassName: "bg-amber-500" },
        { label: "不可用", toneClassName: "bg-red-500" },
        { label: "无样本", toneClassName: "bg-zinc-300" },
      ].map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={clsx("h-2 w-2 rounded-full", item.toneClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ScorePopover({ scoreSummary }: { scoreSummary: Shared.RelayOverviewResponse["scoreSummary"] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const entries = (["availability", "latency", "consistency", "value", "stability", "credibility"] as const).map((label) => [label, scoreSummary[label]] as const);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      if (!toggleRef.current) {
        return;
      }

      const rect = toggleRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(248, Math.max(212, window.innerWidth - viewportPadding * 2));
      const left = Math.min(Math.max(rect.right - width, viewportPadding), window.innerWidth - width - viewportPadding);
      const top = Math.min(rect.bottom + 8, window.innerHeight - viewportPadding);

      setPosition({ left, top, width });
    }

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!popoverRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        aria-label="查看评分拆解"
        aria-expanded={open}
        className="surface-link w-full cursor-pointer p-3.5 text-left"
        data-testid="score-popover-toggle"
        ref={toggleRef}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">评分</p>
        <p className="mt-2 text-[2.2rem] leading-none tracking-[-0.05em]">{scoreSummary.total.toFixed(1)}</p>
        <p className="mt-2 text-xs text-black/58">查看拆解</p>
      </button>
      {open && position ? createPortal(
        <div
          aria-label="评分拆解"
          className="fixed z-[140]"
          data-testid="score-popover"
          ref={popoverRef}
          role="dialog"
          style={{ left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px` }}
        >
          <div className="surface-card border border-black/8 p-3 shadow-[rgba(127,99,21,0.18)_0_18px_40px]">
            <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-2.5">
              <p className="kicker">评分拆解</p>
              <p className="text-sm tracking-[-0.03em] text-black/66">{scoreSummary.total.toFixed(1)}</p>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {entries.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border border-black/8 bg-white/72 px-3 py-2">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">{formatScoreMetricLabel(label)}</p>
                  <p className="text-base tracking-[-0.03em] text-black/82">{value.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function StatusHistoryPanel({ slots }: { slots: Shared.DailyHistorySlot[] }) {
  const measuredSlots = slots.filter((slot) => slot.point);

  if (slots.length === 0) {
    return <p className="text-sm text-black/60">近 30 天还没有状态样本。</p>;
  }

  const healthyCount = measuredSlots.filter((slot) => slot.point && getAvailabilityTrendStatus(slot.point.availability) === "healthy").length;

  return (
    <div className="space-y-3">
      <RelayStatusChart slots={slots} />
      <RelayStatusLegend />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="surface-card px-3 py-2.5 text-sm">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">稳定天数</p>
          <p className="mt-2 text-black/76">{healthyCount} / {measuredSlots.length || 0}</p>
        </div>
        <div className="surface-card px-3 py-2.5 text-sm">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">覆盖度</p>
          <p className="mt-2 text-black/76">{measuredSlots.length} / {slots.length}</p>
        </div>
      </div>
    </div>
  );
}

export function RelayModelsTable({ rows }: { rows: Array<Shared.RelayModelPricingRow | null> }) {
  return (
    <div className="data-table relay-models-table relay-models-table-compact px-1.5" data-testid="relay-models-table">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 pl-2">模型</th>
            <th className="w-[4.6rem] whitespace-nowrap pb-2">状态</th>
            <th className="w-[5.2rem] whitespace-nowrap pb-2 text-right">输入</th>
            <th className="w-[5.2rem] whitespace-nowrap pb-2 pr-2 text-right">输出</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row?.modelKey ?? `placeholder-${index}`} className="align-top">
              {row ? (
                <>
                  <td className="border-b border-black/8 py-2.5 pl-2 pr-3 last:border-b-0">
                    <p className="break-words text-[0.93rem] leading-5 tracking-[-0.03em] [overflow-wrap:anywhere]">{row.modelKey}</p>
                    <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-black/40">{row.vendor}</p>
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-3 text-[0.6rem] uppercase tracking-[0.14em] text-black/44 whitespace-nowrap last:border-b-0">
                    {formatSupportStatusLabel(row.supportStatus)}
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-3 text-right text-[0.92rem] font-medium tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.inputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                  <td className="border-b border-black/8 py-2.5 pr-2 text-right text-[0.92rem] font-medium tabular-nums whitespace-nowrap last:border-b-0">
                    {formatPricePerMillion(row.currentPrice?.outputPricePer1M ?? null, row.currentPrice?.currency ?? "USD")}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-b border-transparent py-2.5 pl-2 pr-3" aria-hidden="true">
                    <span className="block h-5" />
                    <span className="mt-1 block h-3" />
                  </td>
                  <td className="border-b border-transparent py-2.5 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-2.5 pr-3" aria-hidden="true" />
                  <td className="border-b border-transparent py-2.5 pr-2" aria-hidden="true" />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RelayPricingHistoryPanel({
  rows,
}: {
  rows: Shared.RelayPricingHistoryResponse["rows"];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-black/60">当前还没有公开价格历史。</p>;
  }

  const pricingGroups = Array.from(
    rows.reduce((map, row) => {
      const existing = map.get(row.modelKey);

      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(row.modelKey, { modelKey: row.modelKey, rows: [row] });
      }

      return map;
    }, new Map<string, { modelKey: string; rows: Shared.RelayPricingHistoryResponse["rows"][number][] }>()).values(),
  ).map((group) => {
    const sortedRows = [...group.rows].sort(
      (left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime(),
    );
    const latestRow = sortedRows[0];
    const oldestRow = sortedRows.at(-1) ?? latestRow;

    if (!latestRow || !oldestRow) {
      return null;
    }

    return {
      modelKey: group.modelKey,
      latestRow,
      oldestRow,
      rows: sortedRows,
    };
  }).filter((group): group is NonNullable<typeof group> => group !== null);

  return (
    <div className="space-y-3">
      {pricingGroups.map((group) => (
        <div key={group.modelKey} className="surface-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[1.05rem] tracking-[-0.03em] text-black/88">{group.modelKey}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-black/48">最近生效：北京时间 {formatDateTime(group.latestRow.effectiveFrom)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[18rem]">
              <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新输入 / 1M</p>
                <p className="mt-2 text-sm leading-5 text-black/78">{formatPricePerMillion(group.latestRow.inputPricePer1M, group.latestRow.currency)}</p>
              </div>
              <div className="border border-black/8 bg-white/72 px-3 py-2.5">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">最新输出 / 1M</p>
                <p className="mt-2 text-sm leading-5 text-black/78">{formatPricePerMillion(group.latestRow.outputPricePer1M, group.latestRow.currency)}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">价格变更次数</p>
              <p className="mt-2 text-black/76">{group.rows.length} 次</p>
            </div>
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">首个记录</p>
              <p className="mt-2 text-black/76">北京时间 {formatDateTime(group.oldestRow.effectiveFrom)}</p>
            </div>
            <div className="border border-black/8 bg-white/72 px-3 py-2.5 text-sm">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">来源</p>
              <p className="mt-2 text-black/76">{formatPricingSourceLabel(group.latestRow.source)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {group.rows.map((row) => (
              <div
                key={`${row.modelKey}-${row.effectiveFrom}-${row.source}`}
                className="flex flex-col gap-2 border-l-2 border-black/12 pl-3 text-sm leading-6 text-black/72 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-black/46">北京时间 {formatDateTime(row.effectiveFrom)}</p>
                  <p className="mt-1">输入 {formatPricePerMillion(row.inputPricePer1M, row.currency)} / 输出 {formatPricePerMillion(row.outputPricePer1M, row.currency)}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-black/48">来源 {formatPricingSourceLabel(row.source)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelayIncidentTimeline({ rows }: { rows: Shared.RelayIncidentsResponse["rows"] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-black/60">近 30 天没有公开事故记录。</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((incident) => (
        <div key={incident.id} className={clsx("border p-4", getIncidentToneClasses(incident.severity))}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="signal-chip bg-white/70">{formatIncidentSeverityLabel(incident.severity)}</span>
                <span className="text-[0.68rem] uppercase tracking-[0.16em] text-current/70">{incident.endedAt ? "已结束" : "进行中"}</span>
              </div>
              <div>
                <p className="text-[1.05rem] tracking-[-0.03em] text-current">{incident.title}</p>
                <p className="mt-2 text-sm leading-6 text-current/82">{incident.summary}</p>
              </div>
            </div>
            <div className="min-w-[12rem] space-y-1 text-sm leading-6 text-current/78">
              <p>开始：北京时间 {formatDateTime(incident.startedAt)}</p>
              <p>{incident.endedAt ? `结束：北京时间 ${formatDateTime(incident.endedAt)}` : "结束：仍在观察中"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
