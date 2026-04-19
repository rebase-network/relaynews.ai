import * as Shared from "../shared";

const {
  BADGE_COPY,
  ErrorPanel,
  HEALTH_STATUS_COPY,
  Link,
  MethodologyPageSkeleton,
  Panel,
  POLICY_PILLARS,
  StatusDot,
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

const METHODOLOGY_PANEL_TITLE_CLASS_NAME =
  "text-[1.12rem] leading-[1.24] tracking-[-0.01em] md:text-[1.32rem]";

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
    <div className="methodology-page-shell space-y-7 lg:space-y-8">
      <section className="panel methodology-hero bg-[#fff0c2]">
        <p className="kicker">评测方式</p>
        <div className="methodology-hero-grid">
          <div className="methodology-hero-copy">
            <h1 className="max-w-3xl text-[2.3rem] leading-[1.1] tracking-[-0.02em] md:text-[2.82rem]">
              我们如何测试并评估站点服务质量
            </h1>
            <p className="mt-3 max-w-[40rem] text-[1.02rem] leading-8 text-black/78">
              评测只看公开测试信号：可用性、延迟、一致性、性价比与稳定性。
              赞助展示不会并入评分，榜单排序只由自动化测试结果生成。
            </p>
            <p className="methodology-hero-support">
              <span className="methodology-hero-support-label">最近快照</span>
              北京时间 {formatDateTime(data.measuredAt)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/methodology#governance">收录与复核</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
            </div>
          </div>
          <nav aria-label="评测方式页内导航" className="surface-card methodology-map-card">
            <p className="kicker">本页内容</p>
            <div className="methodology-map-list">
              {PAGE_MAP.map((item) => (
                <Link key={item.title} className="methodology-map-link" to={item.to}>
                  <p className="methodology-map-title">{item.title}</p>
                  <p className="methodology-map-copy">{item.copy}</p>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </section>

      <section id="scoring" className="panel methodology-section-shell">
        <div className="methodology-section-head">
          <div>
            <p className="methodology-section-label">评分逻辑</p>
            <h2 className="methodology-section-title">公开排名如何生成</h2>
            <p className="methodology-section-copy">
              排名只看自动化测试得到的公开证据。这里说明当前权重、状态定义，以及榜单里出现的徽章含义。
            </p>
            <p className="methodology-section-meta">五项公开信号 / 赞助不参与排序</p>
          </div>
        </div>
        <div className="methodology-section-grid">
          <div className="surface-card methodology-weight-card">
            <p className="kicker">当前评分构成</p>
            <div className="methodology-weight-list">
              {Object.entries(data.weights).map(([label, value]) => (
                <div key={label} className="methodology-weight-row">
                  <div className="methodology-weight-head">
                    <p className="methodology-weight-label">
                      {formatScoreMetricLabel(label as keyof Shared.RelayOverviewResponse["scoreSummary"])}
                    </p>
                    <p className="methodology-weight-value">{value}%</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/55">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffd900,#fa520f)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="methodology-scoring-side">
            <Panel
              title="公开状态说明"
              className="methodology-section-panel"
              titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
            >
              <div className="methodology-status-list">
                {data.healthStatuses.map((status) => (
                  <div key={status} className="methodology-status-row">
                    <div className="methodology-status-head">
                      <StatusDot status={status} /> {formatHealthStatusLabel(status)}
                    </div>
                    <p className="methodology-status-copy">
                      {HEALTH_STATUS_COPY[status] ?? "公开状态文案基于最近一次的实测证据生成。"}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="徽章含义"
              className="methodology-section-panel"
              titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
            >
              <div className="methodology-badge-grid">
                {data.badges.map((badge) => (
                  <div key={badge} className="methodology-badge-row">
                    <span className="signal-chip">{formatBadgeLabel(badge)}</span>
                    <p className="methodology-badge-copy">
                      {BADGE_COPY[badge] ?? "这个徽章用于解释当前的置信度、性价比或运行状态。"}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
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
            <p className="methodology-section-meta">赞助独立展示 / 支持申诉复核</p>
          </div>
        </div>
        <div className="methodology-governance-top">
          <div className="policy-pillars-grid methodology-governance-principles">
            {POLICY_PILLARS.map((pillar) => (
              <div key={pillar.title} className="policy-pillar">
                <p className="policy-pillar-title">{pillar.title}</p>
                <p className="policy-pillar-copy">{pillar.body}</p>
              </div>
            ))}
          </div>
          <div className="surface-card methodology-governance-card methodology-governance-action">
            <p className="methodology-governance-copy">
              如果你是站点运营者，建议先确认公开 Base URL、支持模型与测试结果，再提交资料或发起复核。目录优先保留可验证、能复测、能持续观察的信息。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/submit">提交站点</Link>
              <Link className="button-cream" to="/probe">先做一次测试</Link>
            </div>
          </div>
        </div>
        <div className="methodology-governance-compare">
          <Panel
            title="哪些因素会影响榜单顺序"
            className="policy-compare-panel methodology-compare-panel"
            titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
          >
            <div className="policy-list">
              {RANKING_SIGNALS.map((item) => (
                <div key={item} className="policy-list-row">{item}</div>
              ))}
            </div>
          </Panel>
          <Panel
            title="哪些因素不会改变评测排名"
            className="policy-compare-panel methodology-compare-panel"
            titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
          >
            <div className="policy-list">
              {RANKING_EXCLUSIONS.map((item) => (
                <div key={item} className="policy-list-row">{item}</div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="methodology-governance-flow">
          <Panel
            title="运营者复核路径"
            className="policy-process-panel methodology-flow-panel"
            titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
          >
            <div className="policy-step-list">
              {REVIEW_STEPS.map((item, index) => (
                <div key={item} className="policy-step-row">
                  <span className="policy-step-index">{String(index + 1).padStart(2, "0")}</span>
                  <p className="policy-step-copy">{item}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="建议的运营动作顺序"
            className="policy-process-panel methodology-flow-panel"
            titleClassName={METHODOLOGY_PANEL_TITLE_CLASS_NAME}
          >
            <div className="policy-sequence-grid">
              {OPERATOR_SEQUENCE.map((item, index) => (
                <div key={item} className="policy-sequence-step">
                  <span className="policy-step-index">{index + 1}</span>
                  <p className="policy-step-copy">{item}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
