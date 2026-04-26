import * as Shared from "../../shared";

const {
  MetricGrid,
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,24rem)] xl:items-start">
        <div className="space-y-3.5">
          <div>
            <h1 className="text-[2.85rem] leading-[0.94] tracking-[-0.05em] md:text-[3.7rem]">{overview.relay.name}</h1>
            {overview.relay.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-black/72">{overview.relay.description}</p>
            ) : null}
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
          {overview.relay.contactInfo ? (
            <div className="max-w-3xl rounded-2xl border border-black/8 bg-white/58 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-black/48">联系方式</p>
              <p className="mt-2 break-words text-sm leading-6 text-black/76">{overview.relay.contactInfo}</p>
            </div>
          ) : null}
        </div>
        <div className="rounded-3xl border border-black/8 bg-white/54 p-3.5">
          <MetricGrid
            columnsClassName="grid-cols-2"
            items={snapshotMetrics.map((item) => ({
              ...item,
              cardClassName: "relay-overview-metric-card",
              valueClassName: "text-[1.2rem] leading-[1.05]",
              valueSpacingClassName: "mt-2",
            }))}
          />
        </div>
      </div>
    </section>
  );
}
