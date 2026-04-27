import type { ReactNode } from "react";
import * as Shared from "../shared";

const {
  BADGE_COPY,
  ErrorPanel,
  HEALTH_STATUS_COPY,
  Link,
  MethodologyPageSkeleton,
  POLICY_PILLARS,
  clsx,
  fetchJson,
  formatBadgeLabel,
  formatDateTime,
  formatHealthStatusLabel,
  formatScoreMetricLabel,
  useEffect,
  useLoadable,
  useLocation,
  usePageMetadata,
} = Shared;

const PAGE_MAP = [
  {
    title: "评分逻辑",
    copy: "权重、状态与徽章",
    to: "/methodology#scoring",
  },
  {
    title: "收录与复核",
    copy: "收录边界、赞助分离与复核流程",
    to: "/methodology#governance",
  },
] as const;

const RANKING_SIGNALS = [
  "可用性与连续成功率",
  "同模型下的延迟与近期一致性",
  "相对同类站点的价格效率",
  "稳定性、事故新鲜度与样本置信度",
] as const;

const RANKING_EXCLUSIONS = [
  "赞助展示或其他推广合作",
  "没有测试证据支撑的人工调位",
  "无法复现、缺少最新证据的个例反馈",
  "单次自助测试结果，它只用于诊断",
] as const;

const REVIEW_STEPS = [
  "资料、端点或支持模型变化后，重新提交最新信息",
  "若公开状态不准确，提供可复现的时间窗口、模型和测试证据",
  "补充证据期间，条目可能进入观察或暂停展示，但赞助展示仍与评测排名分离",
] as const;

const OPERATOR_SEQUENCE = [
  "先做一次受限测试，确认路由与模型行为",
  "再提交 URL、联系方式和必要说明",
  "最后持续观察公开榜单、状态变化和备注",
] as const;

const WEIGHT_ORDER: Array<keyof Shared.MethodologyResponse["weights"]> = [
  "availability",
  "latency",
  "consistency",
  "value",
  "stability",
  "credibility",
];

function MethodologyCard({
  title,
  intro,
  children,
  strong = false,
  className,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <article className={clsx("methodology-card", strong && "methodology-card-strong", className)}>
      <h3 className="methodology-card-title">{title}</h3>
      {intro ? <p className="methodology-card-intro">{intro}</p> : null}
      {children}
    </article>
  );
}

export function MethodologyPage() {
  const location = useLocation();
  const { data, loading, error } = useLoadable<Shared.MethodologyResponse>(
    "/public/methodology",
    () => fetchJson("/public/methodology"),
    [],
  );

  usePageMetadata({
    title: "站点评测方式｜relaynew.ai",
    description:
      "解释站点评分构成、健康状态定义、赞助分离、收录边界与复核路径，帮助运营和用户理解公开评测依据。",
    canonicalPath: "/methodology",
  });

  useEffect(() => {
    if (!data || loading || !location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: "start" });
  }, [data, loading, location.hash]);

  if (loading) return <MethodologyPageSkeleton />;
  if (error || !data) return <ErrorPanel message={error ?? "评测方式页面加载失败。"} />;

  return (
    <div className="methodology-page-shell space-y-4 md:space-y-5">
      <section className="panel methodology-hero bg-[#fff0c2]">
        <div className="methodology-hero-grid">
          <div className="methodology-hero-copy">
            <p className="methodology-eyebrow">评测方式</p>
            <h1 className="methodology-hero-title">我们如何测试并评估站点服务质量</h1>
            <p className="methodology-hero-summary">
              评测只看公开测试信号：可用性、延迟、一致性、性价比与稳定性。
              赞助展示不会并入评分，榜单排序只由自动化测试结果生成。
            </p>
            <div className="methodology-hero-actions">
              <Link className="button-dark" to="/methodology#governance">收录与复核</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
            </div>
          </div>
          <aside className="methodology-hero-side">
            <p className="methodology-hero-side-label">最近快照</p>
            <p className="methodology-hero-side-value">北京时间 {formatDateTime(data.measuredAt)}</p>
            <p className="methodology-hero-side-copy">
              榜单、目录和状态说明都会跟随最近一次公开测试快照同步更新，只展示可追溯的公开证据。
            </p>
          </aside>
        </div>
        <nav aria-label="评测方式页内导航" className="methodology-anchor-strip">
          {PAGE_MAP.map((item) => (
            <Link key={item.title} className="methodology-anchor-link" to={item.to}>
              <p className="methodology-anchor-title">{item.title}</p>
              <p className="methodology-anchor-copy">{item.copy}</p>
            </Link>
          ))}
        </nav>
      </section>

      <section id="scoring" className="panel methodology-section-shell">
        <div className="methodology-section-head">
          <div>
            <p className="methodology-section-label">评分逻辑</p>
            <h2 className="methodology-section-title">公开排名如何生成</h2>
            <p className="methodology-section-copy">
              排名只看自动化测试得到的公开证据。这里集中说明当前权重、公开状态定义，以及榜单里出现的徽章含义。
            </p>
          </div>
          <p className="methodology-section-note">自动化测试信号 / 赞助不参与排序</p>
        </div>
        <div className="methodology-scoring-grid">
          <MethodologyCard
            title="评分构成"
            strong
            intro="六项公开信号共同决定总分，所有维度都来自自动化测试证据。"
          >
            <div className="methodology-weight-list">
              {WEIGHT_ORDER.map((label) => (
                <div key={label} className="methodology-weight-row">
                  <div className="methodology-weight-head">
                    <p className="methodology-weight-label">
                      {formatScoreMetricLabel(label as keyof Shared.RelayOverviewResponse["scoreSummary"])}
                    </p>
                    <p className="methodology-weight-value">{data.weights[label]}%</p>
                  </div>
                  <div className="methodology-weight-bar">
                    <div
                      className="methodology-weight-bar-fill"
                      style={{ width: `${data.weights[label]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </MethodologyCard>

          <MethodologyCard
            title="公开状态"
            intro="状态只描述最近测试窗口的服务表现，不等于运营背书，也不会替代原始得分。"
          >
            <div className="methodology-stack-list">
              {data.healthStatuses.map((status) => (
                <div key={status} className="methodology-stack-row">
                  <p className="methodology-stack-title">{formatHealthStatusLabel(status)}</p>
                  <p className="methodology-stack-copy">
                    {HEALTH_STATUS_COPY[status] ?? "公开状态文案基于最近一次的实测证据生成。"}
                  </p>
                </div>
              ))}
            </div>
          </MethodologyCard>

          <MethodologyCard title="徽章含义" intro="徽章用于补充解释得分与置信度，不单独决定排名。">
            <div className="methodology-badge-list">
              {data.badges.map((badge) => (
                <div key={badge} className="methodology-badge-row">
                  <span className="signal-chip">{formatBadgeLabel(badge)}</span>
                  <p className="methodology-badge-copy">
                    {BADGE_COPY[badge] ?? "这个徽章用于解释当前的置信度、性价比或运行状态。"}
                  </p>
                </div>
              ))}
            </div>
          </MethodologyCard>
        </div>
      </section>

      <section id="governance" className="panel methodology-section-shell methodology-governance-shell">
        <div className="methodology-section-head">
          <div>
            <p className="methodology-section-label">收录与复核</p>
            <h2 className="methodology-section-title">目录如何保持中立与可复核</h2>
            <p className="methodology-section-copy">
              这里说明哪些因素会影响公开排名，哪些内容不会改变评测结果，以及站点运营者如何补充资料和发起复核。
            </p>
          </div>
          <p className="methodology-section-note">收录原则 / 赞助分离 / 支持复核</p>
        </div>
        <div className="methodology-governance-top">
          <div className="methodology-principles-grid">
            {POLICY_PILLARS.map((pillar) => (
              <div key={pillar.title} className="methodology-principle-card">
                <p className="methodology-principle-title">{pillar.title}</p>
                <p className="methodology-principle-copy">{pillar.body}</p>
              </div>
            ))}
          </div>
          <MethodologyCard
            title="给站点运营者"
            strong
            className="methodology-governance-action"
          >
            <p className="methodology-governance-copy">
              如果你是站点运营者，建议先确认官网地址、联系方式、支持模型与测试结果，再提交资料或发起复核。目录优先保留可验证、能复测、能持续观察的信息。
            </p>
            <div className="methodology-governance-actions">
              <Link className="button-dark" to="/submit">提交站点</Link>
              <Link className="button-cream" to="/probe">先做一次测试</Link>
            </div>
          </MethodologyCard>
        </div>
        <div className="methodology-governance-grid">
          <MethodologyCard title="会影响排名">
            <ol className="methodology-ordered-list">
              {RANKING_SIGNALS.map((item) => (
                <li key={item} className="methodology-ordered-row">
                  <p className="methodology-stack-copy">{item}</p>
                </li>
              ))}
            </ol>
          </MethodologyCard>
          <MethodologyCard title="不会改变排名">
            <ol className="methodology-ordered-list">
              {RANKING_EXCLUSIONS.map((item) => (
                <li key={item} className="methodology-ordered-row">
                  <p className="methodology-stack-copy">{item}</p>
                </li>
              ))}
            </ol>
          </MethodologyCard>
          <MethodologyCard title="复核路径">
            <ol className="methodology-ordered-list">
              {REVIEW_STEPS.map((item) => (
                <li key={item} className="methodology-ordered-row">
                  <p className="methodology-stack-copy">{item}</p>
                </li>
              ))}
            </ol>
          </MethodologyCard>
          <MethodologyCard title="建议动作顺序">
            <ol className="methodology-ordered-list">
              {OPERATOR_SEQUENCE.map((item) => (
                <li key={item} className="methodology-ordered-row">
                  <p className="methodology-stack-copy">{item}</p>
                </li>
              ))}
            </ol>
          </MethodologyCard>
        </div>
      </section>
    </div>
  );
}
