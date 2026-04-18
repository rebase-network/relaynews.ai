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
    <div className="space-y-5">
      <section className="panel methodology-hero bg-[#fff0c2]">
        <p className="kicker">评测方式</p>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
          <div className="methodology-hero-copy">
            <h1 className="max-w-3xl text-[2.55rem] leading-[0.94] tracking-[-0.05em] md:text-[3.05rem]">
              我们如何测试并评估站点服务质量。
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-black/70">
              评测综合五项公开信号：可用性、延迟、一致性、性价比与稳定性。
              赞助方展示不会并入评分，因此榜单排序始终只看测试结果。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/methodology#governance">我们怎么做</Link>
              <Link className="button-cream" to="/probe">开始测试</Link>
            </div>
            <p className="methodology-hero-meta">
              快照时间：北京时间 {formatDateTime(data.measuredAt)}
            </p>
          </div>
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
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <Panel title="公开状态说明" className="methodology-section-panel">
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
        <Panel title="徽章含义" className="methodology-section-panel">
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
      </section>

      <section id="governance" className="panel policy-hero bg-[#fff6d8]">
        <p className="kicker">我们怎么做</p>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] xl:items-start">
          <div className="policy-hero-copy">
            <h2 className="max-w-3xl text-[2.2rem] leading-[0.95] tracking-[-0.05em] md:text-[2.8rem]">
              目录保持中立、可观测，并支持运营者申诉与复核。
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-black/70">
              这里解释哪些结论由测试结果驱动，哪些属于运营或编辑判断，以及站点运营者如何修正公开信息。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="button-dark" to="/submit">提交站点</Link>
              <Link className="button-cream" to="/probe">先做一次测试</Link>
            </div>
          </div>
          <div className="policy-pillars-grid">
            {POLICY_PILLARS.map((pillar) => (
              <div key={pillar.title} className="policy-pillar">
                <p className="policy-pillar-title">{pillar.title}</p>
                <p className="policy-pillar-copy">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="哪些因素会影响榜单顺序" className="policy-compare-panel">
          <div className="policy-list">
            <div className="policy-list-row">实测可用性，以及请求成功的连续性表现。</div>
            <div className="policy-list-row">特定模型分类下的延迟分布与近期一致性。</div>
            <div className="policy-list-row">相对同类站点的价格效率与性价比。</div>
            <div className="policy-list-row">稳定性信号、事故新鲜度，以及样本量带来的置信度。</div>
          </div>
        </Panel>
        <Panel title="哪些因素不会改变评测排名" className="policy-compare-panel">
          <div className="policy-list">
            <div className="policy-list-row">赞助套餐、合作露出或其他推广展示。</div>
            <div className="policy-list-row">缺乏测量变化支撑的人工调位请求。</div>
            <div className="policy-list-row">无法复现、也没有最新证据支撑的单次 anecdote。</div>
            <div className="policy-list-row">单独一次测试成功本身；公开测试用于诊断连通性，不直接定义排名。</div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="运营者复核路径" className="policy-process-panel">
          <div className="policy-step-list">
            <div className="policy-step-row">
              <span className="policy-step-index">01</span>
              <p className="policy-step-copy">如果站点端点、支持模型或公开信息发生变化，请重新提交最新资料。</p>
            </div>
            <div className="policy-step-row">
              <span className="policy-step-index">02</span>
              <p className="policy-step-copy">如果你认为公开状态不准确，请提供可复现的测试数据、受影响模型与时间窗口。</p>
            </div>
            <div className="policy-step-row">
              <span className="policy-step-index">03</span>
              <p className="policy-step-copy">补充证据期间，条目可能会暂停或标记为观察中，但赞助展示与评测排名仍保持分离。</p>
            </div>
          </div>
        </Panel>
        <Panel title="建议的运营动作顺序" className="policy-process-panel">
          <div className="policy-sequence-grid">
            <div className="policy-sequence-step">
              <span className="policy-step-index">1</span>
              <p className="policy-step-copy">先用受限测试验证公开路由、API 协议族和模型行为是否正常。</p>
            </div>
            <div className="policy-sequence-step">
              <span className="policy-step-index">2</span>
              <p className="policy-step-copy">再提交规范的 URL、运营者联系信息与必要说明。</p>
            </div>
            <div className="policy-sequence-step">
              <span className="policy-step-index">3</span>
              <p className="policy-step-copy">最后持续观察公开榜单、状态变化与备注说明。</p>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
