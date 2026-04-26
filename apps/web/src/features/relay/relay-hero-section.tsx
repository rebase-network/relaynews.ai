import * as Shared from "../../shared";

const {
  MetricGrid,
  formatProbeMeasuredAt,
} = Shared;

export function RelayHeroSection({
  overview,
  snapshotMetrics,
}: {
  overview: Shared.RelayOverviewResponse;
  snapshotMetrics: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section className="panel relay-hero-panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
      <p className="kicker">Relay 详情</p>
      <div className="space-y-3.5">
        <div className="relay-hero-meta">
          <span className="text-black/46">北京时间 {formatProbeMeasuredAt(overview.measuredAt)}</span>
        </div>
        <div>
          <h1 className="text-[2.85rem] leading-[0.94] tracking-[-0.05em] md:text-[3.7rem]">{overview.relay.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-black/70">
            以下状态、可用性与延迟均按模型展示，帮助你快速判断这个 Relay 下每个模型近期是否可用。
          </p>
        </div>
        <div className="relay-hero-links">
          <span className="relay-base-url-chip" title={overview.relay.baseUrl}>
            {overview.relay.baseUrl}
          </span>
          {overview.relay.websiteUrl ? (
            <a className="signal-chip" href={overview.relay.websiteUrl} rel="noreferrer" target="_blank">
              访问官网
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-4">
        <MetricGrid
          columnsClassName="grid-cols-2 lg:grid-cols-4"
          items={snapshotMetrics.map((item) => ({
            ...item,
            cardClassName: "relay-overview-metric-card",
            valueClassName: "text-[1.2rem] leading-[1.05]",
            valueSpacingClassName: "mt-2",
          }))}
        />
      </div>
    </section>
  );
}
