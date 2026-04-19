export function SubmitHero() {
  return (
    <div className="panel hero-panel submit-hero-panel min-h-0">
      <p className="submit-hero-label">提交站点</p>
      <h1 className="submit-hero-title">
        把你的Relay站点信息提交，收录到站点目录中，有机会进入榜单排行，获得更多用户的认可
      </h1>
      <p className="submit-hero-copy">
        请提供中转站点的介绍，支持的模型、价格信息等等，这些信息将由社区运营志愿者整理后作为站点说明和价格表。
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
