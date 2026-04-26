import * as Shared from "../shared";
import { RelayHeroSection } from "../features/relay/relay-hero-section";
import { RelayModelHealthSection } from "../features/relay/relay-model-health-section";

const {
  ErrorPanel,
  RelayPageSkeleton,
  fetchJson,
  formatPricePerMillion,
  useLoadable,
  usePageMetadata,
  useParams,
} = Shared;

export function RelayPage() {
  const { slug = "aurora-relay" } = useParams();
  const overview = useLoadable<Shared.RelayOverviewResponse>(
    `/public/relay/${slug}/overview`,
    () => fetchJson(`/public/relay/${slug}/overview`),
    [slug],
  );
  const modelHealth = useLoadable<Shared.RelayModelHealthResponse>(
    `/public/relay/${slug}/model-health?window=7d`,
    () => fetchJson(`/public/relay/${slug}/model-health?window=7d`),
    [slug],
  );
  const relayName = overview.data?.relay.name ?? slug;

  usePageMetadata({
    title: `${relayName} Relay 详情｜relaynew.ai`,
    description:
      overview.data
        ? `查看 ${overview.data.relay.name} 支持模型的当前状态、7天可用性、代表延迟与当前价格。`
        : "查看这个站点支持模型的当前状态、7天可用性、代表延迟与当前价格。",
  });

  if (overview.loading) return <RelayPageSkeleton />;
  if (overview.error || !overview.data) return <ErrorPanel message={overview.error ?? "Relay 详情加载失败。"} />;

  const snapshotMetrics = [
    { label: "模型数", value: overview.data.supportedModelsCount },
    { label: "起始输入 / 1M", value: formatPricePerMillion(overview.data.startingInputPricePer1M) },
    { label: "起始输出 / 1M", value: formatPricePerMillion(overview.data.startingOutputPricePer1M) },
    { label: "最近快照", value: Shared.formatProbeMeasuredAt(overview.data.measuredAt) },
  ];

  return (
    <div className="space-y-4">
      <RelayHeroSection overview={overview.data} snapshotMetrics={snapshotMetrics} />
      <RelayModelHealthSection
        error={modelHealth.error}
        loading={modelHealth.loading}
        modelHealth={modelHealth.data}
      />
    </div>
  );
}
