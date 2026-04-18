import { type HomeSummaryResponse, type LeaderboardResponse } from "@relaynews/shared";
import {
  Link,
  clsx,
  formatAvailability,
  formatBadgeLabel,
  formatDateTime,
  formatHealthStatusLabel,
  formatIncidentSeverityLabel,
  formatLatency,
  getIncidentToneClasses,
  getLeaderboardPath,
  getStatusToneClass,
} from "../shared-base";

export function StatusDot({ status }: { status: string }) {
  return <span className={clsx("status-dot inline-block h-2.5 w-2.5", getStatusToneClass(status))} />;
}

export function MetricGrid({
  items,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  items: Array<{
    label: string;
    value: string | number;
    testId?: string;
    cardClassName?: string;
    valueClassName?: string;
    valueSpacingClassName?: string;
    valueTitle?: string;
  }>;
  columnsClassName?: string;
}) {
  return (
    <div className={clsx("grid gap-4", columnsClassName)}>
      {items.map((item) => (
        <div key={item.label} className={clsx("metric-card transition-colors", item.cardClassName)}>
          <p className="kicker">{item.label}</p>
          <p
            className={clsx(item.valueSpacingClassName ?? "mt-3", "tracking-[-0.04em]", item.valueClassName ?? "text-3xl")}
            data-testid={item.testId}
            title={item.valueTitle}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CompactBadgeList({
  badges,
  limit = 2,
  className,
}: {
  badges: string[];
  limit?: number;
  className?: string;
}) {
  const visibleBadges = badges.slice(0, limit);
  const remainingCount = badges.length - visibleBadges.length;

  return (
    <div className={clsx("flex flex-wrap gap-1.5", className)}>
      {visibleBadges.map((badge) => (
        <span key={badge} className="signal-chip">
          {badge}
        </span>
      ))}
      {remainingCount > 0 ? <span className="signal-chip">+{remainingCount}</span> : null}
    </div>
  );
}

export function LeaderboardPreviewCard({
  board,
  rowLimit,
}: {
  board: HomeSummaryResponse["leaderboards"][number];
  rowLimit?: number;
}) {
  const rows = board.rows.slice(0, rowLimit ?? board.rows.length);

  return (
    <section className="panel leaderboard-preview-card h-full">
      <div className="leaderboard-preview-header">
        <div>
          <h2 className="leaderboard-preview-title">{board.modelName}</h2>
          <p className="leaderboard-preview-meta">最新快照 · {formatDateTime(board.measuredAt)}</p>
        </div>
        <Link className="leaderboard-preview-link" to={getLeaderboardPath(board.modelKey)}>
          查看完整榜单
        </Link>
      </div>
      <div className="leaderboard-preview-stack">
        {rows.map((row) => (
          <Link key={row.relay.slug} className="surface-link leaderboard-preview-row" to={`/relay/${row.relay.slug}`}>
            <div className="leaderboard-preview-main min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-black/50">#{row.rank}</p>
                <p className="leaderboard-preview-name">{row.relay.name}</p>
              </div>
              <CompactBadgeList badges={row.badges.map(formatBadgeLabel)} className="leaderboard-preview-badges" limit={1} />
            </div>
            <div className="leaderboard-preview-score">
              <p className="leaderboard-preview-score-value">{row.score.toFixed(1)}</p>
              <div className="leaderboard-preview-scoreline">
                <StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)}
              </div>
              <p className="leaderboard-preview-metrics">
                {formatAvailability(row.availability24h)} · {formatLatency(row.latencyP50Ms)}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <p className="leaderboard-preview-snapshot">快照时间：{formatDateTime(board.measuredAt)}</p>
    </section>
  );
}

export function HomeIncidentCard({
  incident,
}: {
  incident: HomeSummaryResponse["latestIncidents"][number];
}) {
  const incidentOngoing = incident.endedAt === null;

  return (
    <Link
      className={clsx(
        "surface-link flex h-full flex-col justify-between gap-4 border p-4 transition-transform hover:-translate-y-[1px]",
        getIncidentToneClasses(incident.severity),
      )}
      to={`/relay/${incident.relay.slug}`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="signal-chip bg-white/70">{formatIncidentSeverityLabel(incident.severity)}</span>
          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-current/72">
            {incidentOngoing ? "仍在影响中" : "已记录"}
          </span>
        </div>
        <div>
          <p className="text-[1.08rem] tracking-[-0.03em] text-current">{incident.title}</p>
          <p className="mt-2 text-sm leading-6 text-current/82">{incident.summary}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm leading-6 text-current/80">
        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-current/64">{incident.relay.name}</p>
        <p>开始：北京时间 {formatDateTime(incident.startedAt)}</p>
        <p>{incidentOngoing ? "结束：仍在观察中" : `结束：北京时间 ${formatDateTime(incident.endedAt ?? incident.startedAt)}`}</p>
      </div>
    </Link>
  );
}

export function LeaderboardRowCard({ row }: { row: LeaderboardResponse["rows"][number] }) {
  return (
    <article className="surface-card leaderboard-mobile-row p-3.5 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-black/55">#{row.rank}</p>
          <Link to={`/relay/${row.relay.slug}`} className="mt-1 block text-[1.5rem] leading-[0.96] tracking-[-0.04em] hover:underline">
            {row.relay.name}
          </Link>
          <CompactBadgeList badges={row.badges.map(formatBadgeLabel)} className="mt-3" />
        </div>
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-black/62">
            <StatusDot status={row.healthStatus} /> {formatHealthStatusLabel(row.healthStatus)}
          </div>
          <p className="mt-3 text-[2rem] leading-[0.94] tracking-[-0.05em]">{row.score.toFixed(1)}</p>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-black/46">评分</p>
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">24h 可用性</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatAvailability(row.availability24h)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">P50 延迟</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{formatLatency(row.latencyP50Ms)}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输入价格 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.inputPricePer1M ?? "-"}</p>
        </div>
        <div className="border border-black/8 bg-white/72 px-3 py-2.5">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-black/46">输出价格 / 1M</p>
          <p className="mt-2 text-sm leading-5 text-black/78">{row.outputPricePer1M ?? "-"}</p>
        </div>
      </div>
    </article>
  );
}
