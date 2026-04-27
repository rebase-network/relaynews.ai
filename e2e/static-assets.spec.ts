import { expect, test } from "@playwright/test";

test("public crawl and icon assets bypass the SPA fallback", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(robots.headers()["content-type"]).not.toContain("text/html");
  await expect(robots.text()).resolves.toContain("Sitemap: https://relaynew.ai/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(sitemap.headers()["content-type"]).not.toContain("text/html");
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("<urlset");
  expect(sitemapText).toContain("https://relaynew.ai/leaderboard");
  expect(sitemapText).toContain("https://relaynew.ai/leaderboard/openai-gpt-5.4");
  expect(sitemapText).toContain("https://relaynew.ai/leaderboard/anthropic-claude-sonnet-4.6");
  expect(sitemapText).toContain("https://relaynew.ai/relay/aurora-relay");
  expect(sitemapText).not.toContain("https://relaynew.ai/leaderboard/gpt-5.4");
  expect(sitemapText).not.toContain("https://relaynew.ai/relay/easyrouter");

  const favicon = await request.get("/favicon.ico");
  expect(favicon.ok()).toBeTruthy();
  expect(favicon.headers()["content-type"]).not.toContain("text/html");
  const faviconBody = await favicon.body();
  expect(faviconBody.subarray(0, 4).toString("hex")).toBe("00000100");
});

test("homepage HTML exposes crawlable fallback content", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();

  expect(html).toContain('lang="zh-CN"');
  expect(html).toContain("发现优质AI服务商，快速测试API，建立公开目录");
  expect(html).toContain("查看站点目录");
});

test("critical route HTML exposes route-level fallback content", async ({ request }) => {
  const leaderboard = await request.get("/leaderboard/openai-gpt-5.4");
  expect(leaderboard.ok()).toBeTruthy();
  const leaderboardHtml = await leaderboard.text();
  expect(leaderboardHtml).toContain("openai-gpt-5.4 站点榜单");
  expect(leaderboardHtml).toContain("榜单排序只基于公开自动化测试结果生成");
  expect(leaderboardHtml).toContain("<title>openai-gpt-5.4 站点榜单｜relaynew.ai</title>");

  const relay = await request.get("/relay/aurora-relay");
  expect(relay.ok()).toBeTruthy();
  const relayHtml = await relay.text();
  expect(relayHtml).toContain("Aurora Relay 详情");
  expect(relayHtml).toContain("查看 Aurora Relay 的官网地址");
});
