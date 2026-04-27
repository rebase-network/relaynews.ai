export type StaticRoute = {
  path: string;
  title: string;
  description: string;
  heading: string;
  eyebrow: string;
  body: string;
};

const modelRoutes = [
  "anthropic-claude-sonnet-4.6",
  "anthropic-claude-opus-4.6",
  "openai-gpt-5.4",
  "google-gemini-3.1",
  "anthropic-claude-sonnet-4",
  "openai-gpt-4.1",
  "openai-gpt-4.1-mini",
].map((modelKey) => ({
  path: `/leaderboard/${modelKey}`,
  title: `${modelKey} 站点榜单｜relaynew.ai`,
  description: `查看 ${modelKey} 模型分类下的 Relay 站点评测排名，基于可用性、延迟、稳定性、价格与可信度。`,
  heading: `${modelKey} 站点榜单`,
  eyebrow: "模型榜单",
  body: "榜单排序只基于公开自动化测试结果生成，赞助展示不会插入自然排名。",
}));

const relayRoutes = [
  ["aurora-relay", "Aurora Relay"],
  ["ember-gateway", "Ember Gateway"],
  ["solstice-router", "Solstice Router"],
].map(([slug, name]) => ({
  path: `/relay/${slug}`,
  title: `${name} 详情｜relaynew.ai`,
  description: `查看 ${name} 的官网地址、联系方式、支持模型、7 天可用性、当前价格和最近验证时间。`,
  heading: `${name} 详情`,
  eyebrow: "Relay 详情",
  body: "详情页展示该站点当前公开观测到的模型健康、延迟、价格和最近验证信息。",
}));

export const staticRoutes: StaticRoute[] = [
  {
    path: "/",
    title: "relaynew.ai｜大模型API服务站监控、榜单与测试",
    description: "面向中国用户的大模型API服务站目录与评测平台，提供站点榜单、API 测试与站点提交入口。",
    heading: "发现优质AI服务商，快速测试API，建立公开目录",
    eyebrow: "公开目录与实测榜单",
    body: "relaynew.ai 提供大模型 API Relay 的公开榜单、健康度监控、延迟与价格信号，并提供站点提交和自助测试入口。",
  },
  {
    path: "/leaderboard",
    title: "模型目录｜relaynew.ai",
    description: "按模型分类浏览已跟踪的 Relay 站点，查看状态、延迟和价格信号。",
    heading: "按模型分类浏览已跟踪的 Relay 站点",
    eyebrow: "模型目录",
    body: "先选择你关心的模型，再进入对应榜单查看当前可用站点，以及状态、延迟和价格信号。",
  },
  ...modelRoutes,
  ...relayRoutes,
  {
    path: "/methodology",
    title: "站点评测方式｜relaynew.ai",
    description: "了解 relaynew.ai 的评分构成、公开状态、徽章含义、赞助分离和复核路径。",
    heading: "我们如何测试并评估站点服务质量",
    eyebrow: "评测方式",
    body: "评测只看公开测试信号：可用性、延迟、一致性、性价比与稳定性。赞助展示不会并入评分。",
  },
  {
    path: "/submit",
    title: "提交站点信息｜relaynew.ai",
    description: "提交 Relay 站点信息、支持模型、价格和测试 Key，进入审核与后续评测流程。",
    heading: "提交你的 Relay 站点",
    eyebrow: "提交站点",
    body: "把站点信息、支持模型和价格提交到公开目录。审核通过后会进入后续评测流程。",
  },
  {
    path: "/probe",
    title: "站点测试｜relaynew.ai",
    description: "在线测试站点连通性、协议状态、兼容模式、HTTP 状态和请求轨迹。",
    heading: "运行测试",
    eyebrow: "自助测试",
    body: "填写 Base URL、API Key 和模型后开始测试。结果页不会回显你的 API Key。",
  },
];
