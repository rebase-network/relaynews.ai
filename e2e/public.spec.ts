import { expect, test, type Locator, type Page } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const allowDeployedWrites = process.env.E2E_ALLOW_DEPLOYED_WRITES === "1";
const apiBaseUrl =
  process.env.API_BASE_URL ?? (isDeployedRun ? "https://api.relaynew.ai" : "http://127.0.0.1:8787");
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_AUTH_USERNAME ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_AUTH_PASSWORD ?? "";
const probeUrl = process.env.API_URL ?? "";
const probeKey = process.env.API_KEY ?? "";
const probeConfigured = Boolean(probeUrl && probeKey && probeUrl !== "https://example.com");
const manualCompatibilityMode = process.env.LLM_API_TYPE ?? "auto";

const manualCompatibilityLabels: Record<string, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  "anthropic-messages": "Anthropic Messages",
};

function buildBasicAuthorization(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function getAdminApiHeaders() {
  if (!adminUsername || !adminPassword) {
    return undefined;
  }

  return {
    Authorization: buildBasicAuthorization(adminUsername, adminPassword),
  };
}

async function gotoHome(page: Page) {
  const heroHeading = page.getByRole("heading", { name: /发现优质中转站点/i });
  const fetchError = page.getByText("Failed to fetch");

  await page.goto("/");

  try {
    await heroHeading.waitFor({ state: "visible", timeout: 8_000 });
  } catch {
    if (await fetchError.isVisible().catch(() => false)) {
      await page.reload();
    }

    await heroHeading.waitFor({ state: "visible", timeout: 8_000 });
  }
}

async function expectRelayDetailModules(page: Page) {
  await expect(page.getByRole("heading", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "延迟" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "状态" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型支持" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "价格历史" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "事故时间线" })).toHaveCount(0);
  await expect(page.getByTestId("relay-latency-bar")).toHaveCount(30);
  await expect(page.getByTestId("relay-status-bar")).toHaveCount(30);
  await expect(page.getByTestId("relay-models-table")).toHaveCount(2);
  await expect(page.getByText("Capabilities")).toHaveCount(0);

  const latencyChartBox = await page.getByTestId("relay-latency-chart").boundingBox();
  const statusChartBox = await page.getByTestId("relay-status-chart").boundingBox();
  expect(latencyChartBox).not.toBeNull();
  expect(statusChartBox).not.toBeNull();
  expect(Math.abs(latencyChartBox!.width - statusChartBox!.width)).toBeLessThan(2);

  await page.getByTestId("score-popover-toggle").click();
  await expect(page.getByTestId("score-popover")).toBeVisible();
  await expect(page.getByTestId("score-popover")).toContainText("评分拆解");
  await page.getByRole("heading", { name: "Aurora Relay" }).click();
  await expect(page.getByTestId("score-popover")).toHaveCount(0);
}

async function expectLeaderboardRules(page: Page) {
  await expect(page.getByText("当前榜单不含赞助方")).toBeVisible();
  await expect(page.getByText("当前仅展示这个模型分类下的评测结果；赞助方展示不会插入排名。")).toBeVisible();
  const noteBand = page.locator(".leaderboard-note-band");
  await expect(noteBand).toContainText("当前榜单只基于自动化测试结果生成，不接受赞助调位");
  await expect(noteBand).toContainText("评测方式");
  await expect(noteBand).toContainText("我们怎么做");
}

async function expectVisibleText(locator: Locator, pattern: RegExp) {
  await expect(locator.getByText(pattern).first()).toBeVisible();
}

async function expectPageMetadata(page: Page, expectation: {
  canonicalPath: string;
  descriptionPattern: RegExp;
  titlePattern: RegExp;
}) {
  await expect(page).toHaveTitle(expectation.titlePattern);

  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveCount(1);
  const descriptionContent = await description.getAttribute("content");
  expect(descriptionContent).not.toBeNull();
  expect(descriptionContent!.length).toBeGreaterThanOrEqual(20);
  expect(descriptionContent!.length).toBeLessThanOrEqual(220);
  expect(descriptionContent!).toMatch(expectation.descriptionPattern);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  const canonicalHref = await canonical.getAttribute("href");
  expect(canonicalHref).not.toBeNull();
  const canonicalUrl = new URL(canonicalHref!);
  expect(canonicalUrl.pathname).toBe(expectation.canonicalPath);
  expect(canonicalUrl.search).toBe("");
  expect(canonicalUrl.hash).toBe("");
}

test("public site renders the main discovery flow", async ({ page }) => {
  await gotoHome(page);
  await expect(page.getByRole("heading", { name: /发现优质中转站点/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "开始测试" })).toBeVisible();
  await expect(page.getByText("快速测试", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "打开完整测试页" })).toBeVisible();
  await expect(page.getByText("赞助商")).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近事件" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Watchlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Incidents" })).toHaveCount(0);
  await expect(page.getByText("赞助展示会保持清晰可辨，绝不会改写自然榜单中的实测排序。"))
    .toHaveCount(0);

  if (isDeployedRun) {
    await page.getByRole("link", { name: "榜单" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
    await expectLeaderboardRules(page);

    await page.getByRole("link", { name: "评测方式" }).click();
    await expect(page).toHaveURL(/\/methodology$/);
    await expect(page.getByText("评测方式")).toBeVisible();

    await page.getByRole("link", { name: "站点测试" }).click();
    await expect(page).toHaveURL(/\/probe$/);
    await expect(page.getByRole("heading", { name: "运行测试" })).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: "站点榜单" })).toHaveCount(0);
  await page.getByRole("link", { name: "查看全部站点" }).click();
  await expect(page).toHaveURL(/\/leaderboard\/directory$/);
  await expect(page.getByText("榜单目录")).toBeVisible();
  await expect(page.getByLabel("Search lanes")).toHaveCount(0);
  await page.getByRole("button", { name: "Google" }).click();
  await expect(page.getByRole("heading", { name: "Gemini 3.1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sonnet 4.6" })).toHaveCount(0);

  await gotoHome(page);
  const featuredSection = page.locator("section").filter({ has: page.getByRole("link", { name: "查看全部站点" }) }).first();
  await expect(featuredSection.getByRole("heading", { name: "Sonnet 4.6" })).toBeVisible();
  await expect(featuredSection.getByRole("heading", { name: "Opus 4.6" })).toBeVisible();
  await expect(featuredSection.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
  await expect(featuredSection.getByRole("heading", { name: "Gemini 3.1" })).toBeVisible();
  await expect(featuredSection.getByText("anthropic-claude-sonnet-4.6")).toHaveCount(0);
  await expect(featuredSection.getByText("anthropic-claude-opus-4.6")).toHaveCount(0);
  await expect(featuredSection.getByText("openai-gpt-5.4")).toHaveCount(0);
  await expect(featuredSection.getByText("google-gemini-3.1")).toHaveCount(0);

  const gptBoardCard = featuredSection.locator("section").filter({
    has: page.getByRole("heading", { name: "GPT 5.4" }),
  });
  const gptBoardLink = gptBoardCard.getByRole("link", { name: "查看完整榜单" });
  const gptBoardHref = await gptBoardLink.getAttribute("href");
  expect(gptBoardHref).not.toBeNull();
  const escapedBoardHref = gptBoardHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await gptBoardLink.click();
  await expect(page).toHaveURL(new RegExp(`${escapedBoardHref}$`));
  await expectLeaderboardRules(page);
  await expect(page.getByRole("link", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("Search and filters")).toHaveCount(0);
  await expect(page.getByLabel("Search relays")).toHaveCount(0);

  await page.getByRole("link", { name: "Aurora Relay" }).first().click();
  await expect(page).toHaveURL(/relay\/aurora-relay/);
  await expectRelayDetailModules(page);
});

test("legacy policy route redirects to the merged methodology section", async ({ page }) => {
  await page.goto("/policy");
  await expect(page).toHaveURL(/\/methodology#governance$/);
  await expect(page.locator("#governance").getByRole("heading", { name: "目录如何保持中立与可复核" })).toBeVisible();
});

test("submit flow works from the public site", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Submission creation is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const relayName = `Beacon Relay ${Date.now()}`;
  const relayBaseUrl = `https://example.com/relay/${Date.now()}`;

  await page.goto("/submit");
  await expect(page.getByRole("heading", { name: /把你的Relay站点信息提交，收录到站点目录中/i })).toBeVisible();
  await expect(page.getByText(/这些信息将由社区运营志愿者整理后作为站点说明和价格表/)).toBeVisible();
  await expect(page.getByText(/提交后会立即执行一次自动测试，后续会持续测试/)).toBeVisible();
  await page.getByLabel("中转站名称").fill(relayName);
  await page.getByLabel("Base URL").fill(relayBaseUrl);
  await page.getByLabel("站点网站").fill("https://example.com");
  await page.getByLabel("联系方式").fill("Telegram: @beacon_ops");
  await page.getByLabel("中转站简介").fill("Playwright 中文提交流程覆盖，用于验证公开站点审核入口。");
  await page.getByLabel("模型").fill("openai-gpt-5.4");
  await page.getByLabel("Input价格").fill("4.6");
  await page.getByLabel("Output价格").fill("13.2");
  await page.getByLabel("测试API Key").fill("sk-submit-check");
  await page.getByRole("button", { name: "提交" }).click();

  await expect(page.getByText("提交成功，记录 ID：")).toBeVisible();
  await expect(page.getByText(/^初始测试：/)).toBeVisible();
});

test("submit flow validates malformed relay URLs before sending", async ({ page }) => {
  await page.goto("/submit");
  await page.getByLabel("中转站名称").fill("Broken Relay");
  await page.getByLabel("Base URL").fill("relay.example.ai");
  await page.getByLabel("站点网站").fill("not-a-url");
  await page.getByLabel("联系方式").fill("");
  await page.getByLabel("中转站简介").fill("");
  await page.getByLabel("模型").fill("");
  await page.getByRole("button", { name: "提交" }).click();

  await expect(page.getByText("请先修正高亮字段后再提交。")).toBeVisible();
  await expect(page.getByText("请输入完整的 HTTPS 基础 URL，例如 https://relay.example.ai/v1。")).toBeVisible();
  await expect(page.getByText("请输入有效的网站地址，例如 https://relay.example.ai。")).toBeVisible();
  await expect(page.getByText("请填写联系方式。")).toBeVisible();
  await expect(page.getByText("请补充简要说明，帮助审核队列快速理解这个站点。")).toBeVisible();
  await expect(page.getByText("请为每一行填写模型。")).toBeVisible();
  await expect(page.getByText("初始测试需要测试API Key。")).toBeVisible();
  await expect(page.getByText("提交成功，记录 ID：")).toHaveCount(0);
});

test("relay detail APIs hide unsupported models and their price history", async ({ request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Relay lifecycle writes are skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );

  const runId = Date.now();
  const relayName = `Filtered Relay ${runId}`;
  const relayBaseUrl = `https://example.com/filtered-relay-${runId}`;
  const removedModelKey = "anthropic-claude-sonnet-4.6";

  const createResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      name: relayName,
      baseUrl: relayBaseUrl,
      websiteUrl: "https://example.com",
      contactInfo: "Telegram: @filtered_ops",
      description: "用于验证不支持的模型不会继续出现在 Relay 详情公开接口中。",
      catalogStatus: "active",
      modelPrices: [
        {
          modelKey: "openai-gpt-5.4",
          inputPricePer1M: 4.6,
          outputPricePer1M: 15.8,
        },
        {
          modelKey: removedModelKey,
          inputPricePer1M: 6.2,
          outputPricePer1M: 24.5,
        },
      ],
      testApiKey: "sk-filtered-check",
      compatibilityMode: "auto",
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const createdRelay = await createResponse.json();

  const relaysResponse = await request.get(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
  });
  expect(relaysResponse.ok()).toBeTruthy();
  const relaysPayload = await relaysResponse.json();
  const relay = relaysPayload.rows.find((row: { id: string; slug: string }) => row.id === createdRelay.id);
  expect(relay).toBeTruthy();

  const patchResponse = await request.patch(`${apiBaseUrl}/admin/relays/${createdRelay.id}`, {
    headers: getAdminApiHeaders(),
    data: {
      name: relayName,
      baseUrl: relayBaseUrl,
      websiteUrl: "https://example.com",
      contactInfo: "Telegram: @filtered_ops",
      description: "用于验证不支持的模型不会继续出现在 Relay 详情公开接口中。",
      catalogStatus: "active",
      modelPrices: [
        {
          modelKey: "openai-gpt-5.4",
          inputPricePer1M: 4.6,
          outputPricePer1M: 15.8,
        },
      ],
      testApiKey: "sk-filtered-check",
      compatibilityMode: "auto",
    },
  });
  expect(patchResponse.ok()).toBeTruthy();

  const modelsResponse = await request.get(`${apiBaseUrl}/public/relay/${relay.slug}/models`);
  expect(modelsResponse.ok()).toBeTruthy();
  const modelsPayload = await modelsResponse.json();
  expect(modelsPayload.rows.map((row: { modelKey: string }) => row.modelKey)).not.toContain(removedModelKey);

  const pricingResponse = await request.get(`${apiBaseUrl}/public/relay/${relay.slug}/pricing-history`);
  expect(pricingResponse.ok()).toBeTruthy();
  const pricingPayload = await pricingResponse.json();
  expect(pricingPayload.rows.map((row: { modelKey: string }) => row.modelKey)).not.toContain(removedModelKey);
});

test("public probe flow returns a diagnostic result", async ({ page }) => {
  test.skip(!probeConfigured, "Probe E2E requires API_URL and API_KEY in .env.");
  const probeModel = process.env.LLM_MODEL ?? "openai-gpt-4.1";

  await page.goto("/probe");
  await page.getByLabel("Base URL").fill(probeUrl);
  await page.getByLabel("API Key").fill(probeKey);
  await page.getByLabel("模型").fill(probeModel);
  await page.getByRole("button", { name: "开始测试" }).click();

  await expect(page.getByText("测试结果")).toBeVisible();
  await expect(page.getByText(/测试通过|协议状态降级|协议检查失败|连通性失败/).first()).toBeVisible();
  await expect(page.getByTestId("probe-host-value")).toContainText(new URL(probeUrl).host);
  await expect(page.getByTestId("probe-connectivity-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-protocol-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-detection-value")).toHaveText("自动识别");
  await expect(page.getByTestId("probe-mode-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-model-value")).toHaveText(probeModel);
  await expect(page.getByTestId("probe-http-status-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-measured-at-value")).toHaveText(/\S+/);
});

test("public probe supports manual compatibility override", async ({ page }) => {
  test.skip(!probeConfigured, "Probe E2E requires API_URL and API_KEY in .env.");
  test.skip(!manualCompatibilityLabels[manualCompatibilityMode], "Set LLM_API_TYPE to a supported manual compatibility mode.");
  const probeModel = process.env.LLM_MODEL ?? "openai-gpt-4.1";

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/probe");
  await page.getByLabel("Base URL").fill(probeUrl);
  await page.getByLabel("API Key").fill(probeKey);
  await page.getByLabel("模型").fill(probeModel);
  await page.locator("summary").filter({ hasText: "高级选项 / 接口类型" }).click();
  await page.getByLabel("兼容模式").selectOption(manualCompatibilityMode);
  await page.getByRole("button", { name: "开始测试" }).click();

  await expect(page.getByText("测试结果")).toBeVisible();
  await expect(page.getByText("测试通过")).toBeVisible();
  await expect(page.getByTestId("probe-connectivity-value")).toHaveText("正常");
  await expect(page.getByTestId("probe-protocol-value")).toHaveText("健康");
  await expect(page.getByTestId("probe-detection-value")).toHaveText("手动指定");
  await expect(page.getByTestId("probe-mode-value")).toHaveText(manualCompatibilityLabels[manualCompatibilityMode]);
  await expect(page.getByTestId("probe-model-value")).toHaveText(probeModel);
  await expect(page.getByTestId("probe-http-status-value")).toHaveText("200");
  await expect(page.getByText("执行轨迹")).toBeVisible();
  await page.getByTestId("probe-copy-endpoint-button").click();
  await expect(page.getByTestId("probe-copy-endpoint-button")).toHaveText("已复制");
  await expect(page.getByText(/^Upstream returned /)).toHaveCount(0);
});

test("public mobile navigation routes to the primary pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");
  await page.getByRole("button", { name: "打开菜单" }).click();
  let mobileNav = page.locator("#mobile-primary-nav");

  await expect(mobileNav.getByRole("link", { name: "首页" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "榜单" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "评测方式" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "提交站点" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "站点测试" })).toBeVisible();

  await mobileNav.getByRole("link", { name: "榜单" }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();

  await page.getByRole("button", { name: "打开菜单" }).click();
  mobileNav = page.locator("#mobile-primary-nav");
  await mobileNav.getByRole("link", { name: "提交站点" }).click();
  await expect(page).toHaveURL(/\/submit$/);
  await expect(page.getByRole("heading", { name: /把你的Relay站点信息提交，收录到站点目录中/i })).toBeVisible();

  await page.getByRole("button", { name: "打开菜单" }).click();
  mobileNav = page.locator("#mobile-primary-nav");
  await mobileNav.getByRole("link", { name: "站点测试" }).click();
  await expect(page).toHaveURL(/\/probe$/);
  await expect(page.getByRole("heading", { name: "运行测试" })).toBeVisible();
});

test("homepage prioritizes quick probe on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHome(page);

  const quickProbeHeading = page.getByText("快速测试", { exact: true });
  const heroHeading = page.getByRole("heading", { name: /发现优质中转站点/i });
  const quickProbeBox = await quickProbeHeading.boundingBox();
  const heroHeadingBox = await heroHeading.boundingBox();

  expect(quickProbeBox).not.toBeNull();
  expect(heroHeadingBox).not.toBeNull();
  expect(quickProbeBox!.y).toBeLessThan(heroHeadingBox!.y);
});

test("probe page stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");

  await expect(page.getByRole("heading", { name: "运行测试" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "测试结果" })).toBeVisible();
  await expect(page.locator(".input-helper-mobile")).toHaveCount(0);
  await expect(page.locator(".input-helper-desktop")).toHaveCount(0);
  await expect(page.getByText("Before you run")).toHaveCount(0);
  await expect(page.getByText("What the result includes")).toHaveCount(0);
  await expect(page.getByText(/自助测试的API Key等信息不会留存/)).toBeVisible();
  await expect(page.getByText(/结果面板会展示连通性、协议状态、兼容模式识别结果/)).toBeVisible();
  await expect(page.getByRole("button", { name: "开始测试" })).toBeVisible();
});

test("leaderboard remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/leaderboard");

  await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("24h 可用性").first()).toBeVisible();
  await expect(page.getByText("P50 延迟").first()).toBeVisible();
  await expectVisibleText(page.locator("main"), /评测排名|评测方式|赞助分离/);
  await expect(page.getByText("当前榜单不含赞助方")).toBeVisible();
});

test.describe("public metadata smoke", () => {
  test("critical public routes expose route-level metadata", async ({ page }) => {
    await gotoHome(page);
    await expectPageMetadata(page, {
      canonicalPath: "/",
      descriptionPattern: /站点榜单|API 测试|提交入口/i,
      titlePattern: /relaynew\.ai|中转站监控|榜单与测试/i,
    });

    await page.goto("/leaderboard?foo=bar#metadata");
    await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
    await expectPageMetadata(page, {
      canonicalPath: "/leaderboard",
      descriptionPattern: /评测排名|赞助方展示|relay/i,
      titlePattern: /GPT 5\.4|站点榜单|relaynew\.ai/i,
    });

    await page.goto("/methodology?from=metadata#governance");
    await expect(page.getByRole("heading", { name: "我们如何测试并评估站点服务质量" })).toBeVisible();
    await expectPageMetadata(page, {
      canonicalPath: "/methodology",
      descriptionPattern: /评分构成|赞助分离|复核路径/i,
      titlePattern: /评测方式|relaynew\.ai/i,
    });

    await page.goto("/submit?from=metadata");
    await expect(page.getByRole("heading", { name: /把你的Relay站点信息提交，收录到站点目录中/i })).toBeVisible();
    await expectPageMetadata(page, {
      canonicalPath: "/submit",
      descriptionPattern: /提交站点|初始测试|评测排名/i,
      titlePattern: /提交站点信息|relaynew\.ai/i,
    });

    await page.goto("/probe?from=metadata");
    await expect(page.getByRole("heading", { name: "运行测试" })).toBeVisible();
    await expectPageMetadata(page, {
      canonicalPath: "/probe",
      descriptionPattern: /在线测试站点连通性|HTTP 状态|请求轨迹/i,
      titlePattern: /站点测试|relaynew\.ai/i,
    });

    await page.goto("/relay/aurora-relay?from=metadata");
    await expect(page.getByRole("heading", { name: "Aurora Relay" })).toBeVisible();
    await expectPageMetadata(page, {
      canonicalPath: "/relay/aurora-relay",
      descriptionPattern: /延迟走势|模型支持|当前价格|Aurora Relay/i,
      titlePattern: /Aurora Relay|Relay 详情|relaynew\.ai/i,
    });
  });
});
