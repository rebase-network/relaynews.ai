export function SubmitHero() {
  return (
    <div className="panel hero-panel submit-hero-panel min-h-0">
      <p className="submit-hero-label">提交站点</p>
      <h1 className="submit-hero-title">
        提交你的 Relay 站点
      </h1>
      <p className="submit-hero-copy">
        把站点信息、支持模型和价格提交到公开目录。审核通过后会进入后续评测流程，并有机会出现在模型榜单中。
      </p>
      <div className="submit-hero-points">
        <div className="submit-hero-point">
          <p className="submit-hero-point-title">先审核</p>
          <p className="submit-hero-point-copy">每个站点都会先进入运营审核队列，确认后才会出现在公开页面。</p>
        </div>
        <div className="submit-hero-point">
          <p className="submit-hero-point-title">整理信息</p>
          <p className="submit-hero-point-copy">请尽量把站点介绍、支持模型和价格信息填写完整，方便志愿者整理站点说明和价格表。</p>
        </div>
        <div className="submit-hero-point">
          <p className="submit-hero-point-title">初始测试</p>
          <p className="submit-hero-point-copy">提交后会立即执行一次自动测试，后续会持续测试，请确保测试Key可用性。</p>
        </div>
      </div>
    </div>
  );
}
