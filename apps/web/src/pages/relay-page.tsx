import * as Shared from "../shared";
import { RelayHeroSection } from "../features/relay/relay-hero-section";
import { RelayModelHealthSection } from "../features/relay/relay-model-health-section";

const {
  ErrorPanel,
  LEADERBOARD_DIRECTORY_PATH,
  Link,
  RelayPageSkeleton,
  fetchJson,
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
  const isNotFound = !overview.loading && Boolean(overview.error && /not found|404/i.test(overview.error));

  usePageMetadata({
    title: isNotFound ? "Relay 详情不存在｜relaynew.ai" : `${relayName} 详情｜relaynew.ai`,
    description:
      isNotFound
        ? "这个 Relay 暂未进入公开目录，可以返回模型目录、提交站点或开始自助测试。"
        : overview.data
        ? `查看 ${overview.data.relay.name} 支持模型的当前状态、7天可用性、代表延迟与当前价格。`
        : "查看这个站点支持模型的当前状态、7天可用性、代表延迟与当前价格。",
    canonicalPath: isNotFound ? LEADERBOARD_DIRECTORY_PATH : undefined,
    robots: isNotFound ? "noindex,follow" : undefined,
  });

  if (overview.loading) return <RelayPageSkeleton />;
  if (isNotFound) {
    return (
      <section className="panel not-found-panel">
        <p className="kicker">未找到 Relay</p>
        <h1 className="not-found-title">这个站点暂未进入公开目录</h1>
        <p className="not-found-copy">
          当前没有找到 `{slug}` 对应的 Relay 详情。你可以返回模型目录查看已收录站点，或先运行一次自助测试。
        </p>
        <div className="not-found-actions">
          <Link className="button-dark" to={LEADERBOARD_DIRECTORY_PATH}>查看模型目录</Link>
          <Link className="button-cream" to="/submit">提交站点</Link>
          <Link className="button-cream" to="/probe">开始测试</Link>
        </div>
      </section>
    );
  }
  if (overview.error || !overview.data) return <ErrorPanel message={overview.error ?? "Relay 详情加载失败。"} />;

  return (
    <div className="space-y-4">
      <RelayHeroSection overview={overview.data} />
      <RelayModelHealthSection
        error={modelHealth.error}
        loading={modelHealth.loading}
        modelHealth={modelHealth.data}
      />
    </div>
  );
}
