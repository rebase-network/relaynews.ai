import { expect, test, type Locator, type Page } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const allowDeployedWrites = process.env.E2E_ALLOW_DEPLOYED_WRITES === "1";
const probeUrl = process.env.API_URL ?? "";
const probeKey = process.env.API_KEY ?? "";
const probeConfigured = Boolean(probeUrl && probeKey && probeUrl !== "https://example.com");
const manualCompatibilityMode = process.env.LLM_API_TYPE ?? "auto";

const manualCompatibilityLabels: Record<string, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  "anthropic-messages": "Anthropic Messages",
};

async function gotoHome(page: Page) {
  const heroHeading = page.getByRole("heading", { name: /快速发现优质 relay/i });
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
  await expect(page.getByRole("heading", { name: "延迟画像" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "状态" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型支持" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "价格历史" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "事故时间线" })).toBeVisible();
  await expect(page.getByTestId("relay-latency-bar")).toHaveCount(30);
  await expect(page.getByTestId("relay-status-bar")).toHaveCount(30);
  await expect(page.getByTestId("relay-models-table")).toHaveCount(2);
  await expect(page.getByText("Capabilities")).toHaveCount(0);

  const latencyChartBox = await page.getByTestId("relay-latency-chart").boundingBox();
  const statusChartBox = await page.getByTestId("relay-status-chart").boundingBox();
  expect(latencyChartBox).not.toBeNull();
  expect(statusChartBox).not.toBeNull();
  expect(Math.abs(latencyChartBox!.width - statusChartBox!.width)).toBeLessThan(2);

  const pricingSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "价格历史" }),
  }).first();
  const incidentsSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "事故时间线" }),
  }).first();

  await expect(pricingSection).toContainText(/价格变更次数|当前还没有公开价格历史。/);
  await expect(incidentsSection).toContainText(/开始：北京时间|近 30 天没有公开事故记录。/);

  await page.getByTestId("score-popover-toggle").click();
  await expect(page.getByTestId("score-popover")).toBeVisible();
  await expect(page.getByTestId("score-popover")).toContainText("评分拆解");
  await page.getByRole("heading", { name: "Aurora Relay" }).click();
  await expect(page.getByTestId("score-popover")).toHaveCount(0);
}

async function expectRecentIncidentsModule(page: Page) {
  const incidentsSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "最近事件" }),
  }).first();

  await expect(incidentsSection).toBeVisible();
  await expect(incidentsSection).toContainText("与重点榜单、赞助位分别独立展示");
  await expect(incidentsSection).toContainText(/仍在影响中|已记录|当前快照里还没有需要公开提示的最新异常事件。/);
}

async function expectLeaderboardRules(page: Page) {
  await expect(page.getByText("当前表格不含赞助位")).toBeVisible();
  await expect(page.getByText("本页只呈现当前模型赛道的自然排序结果")).toBeVisible();
  await expect(page.getByText("赞助展示只会出现在独立模块，不会混入自然排名表格")).toBeVisible();
}

async function expectVisibleText(locator: Locator, pattern: RegExp) {
  await expect(locator.getByText(pattern).first()).toBeVisible();
}

test("public site renders the main discovery flow", async ({ page }) => {
  await gotoHome(page);
  await expect(page.getByRole("heading", { name: /快速发现优质 relay/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "开始探测" })).toBeVisible();
  await expect(page.getByText("快速探测")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开完整探测页" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "赞助位" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近事件" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Watchlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Incidents" })).toHaveCount(0);
  await expect(page.getByText("赞助展示会保持清晰可辨，绝不会改写自然榜单中的实测排序。"))
    .toHaveCount(0);
  await expectRecentIncidentsModule(page);

  if (isDeployedRun) {
    await page.getByRole("link", { name: "榜单" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
    await expectLeaderboardRules(page);

    await page.getByRole("link", { name: "方法论" }).click();
    await expect(page).toHaveURL(/\/methodology$/);
    await expect(page.getByText("方法论")).toBeVisible();

    await page.getByRole("link", { name: "Relay 探测" }).click();
    await expect(page).toHaveURL(/\/probe$/);
    await expect(page.getByRole("heading", { name: "运行探测" })).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: "重点榜单" })).toBeVisible();
  await page.getByRole("link", { name: "查看全部赛道" }).click();
  await expect(page).toHaveURL(/\/leaderboard\/directory$/);
  await expect(page.getByText("榜单目录")).toBeVisible();
  await expect(page.getByLabel("Search lanes")).toHaveCount(0);
  await page.getByRole("button", { name: "Google" }).click();
  await expect(page.getByRole("heading", { name: "Gemini 3.1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sonnet 4.6" })).toHaveCount(0);

  await gotoHome(page);
  const featuredSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "重点榜单" }) }).first();
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

test("submit flow works from the public site", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Submission creation is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const relayName = `Beacon Relay ${Date.now()}`;
  const relayBaseUrl = `https://example.com/relay/${Date.now()}`;

  await page.goto("/submit");
  await expect(page.getByRole("heading", { name: /把你的 relay 提交到监测、排名或赞助审核流程中。/ })).toBeVisible();
  await expect(page.getByText("运营审批与赞助展示会独立处理，不会影响自然排名逻辑。")).toBeVisible();
  await page.getByLabel("中转站名称").fill(relayName);
  await page.getByLabel("基础 URL").fill(relayBaseUrl);
  await page.getByLabel("网站地址").fill("https://example.com");
  await page.getByLabel("中转站简介").fill("Playwright 中文提交流程覆盖，用于验证公开 relay 审核入口。");
  await page.getByLabel("联系邮箱").fill("ops@example.com");
  await page.getByLabel("测试 API 密钥").fill("sk-submit-check");
  await page.getByLabel("测试模型").fill("gpt-5.4");
  await page.getByRole("button", { name: "提交 Relay" }).click();

  await expect(page.getByText("提交成功，记录 ID：")).toBeVisible();
  await expect(page.getByText(/^初始探测：/)).toBeVisible();
});

test("submit flow validates malformed relay URLs before sending", async ({ page }) => {
  await page.goto("/submit");
  await page.getByLabel("中转站名称").fill("Broken Relay");
  await page.getByLabel("基础 URL").fill("relay.example.ai");
  await page.getByLabel("网站地址").fill("not-a-url");
  await page.getByLabel("中转站简介").fill("");
  await page.getByLabel("联系邮箱").fill("ops@");
  await page.getByLabel("测试模型").fill("");
  await page.getByRole("button", { name: "提交 Relay" }).click();

  await expect(page.getByText("请先修正高亮字段后再提交。")).toBeVisible();
  await expect(page.getByText("请输入完整的 HTTPS 基础 URL，例如 https://relay.example.ai/v1。")).toBeVisible();
  await expect(page.getByText("请输入有效的网站地址，例如 https://relay.example.ai。")).toBeVisible();
  await expect(page.getByText("请补充简要说明，帮助审核队列快速理解这个 relay。")).toBeVisible();
  await expect(page.getByText("请输入有效的联系邮箱。")).toBeVisible();
  await expect(page.getByText("初始 relay 探测需要测试密钥。")).toBeVisible();
  await expect(page.getByText("请填写测试模型。")).toBeVisible();
  await expect(page.getByText("提交成功，记录 ID：")).toHaveCount(0);
});

test("public probe flow returns a diagnostic result", async ({ page }) => {
  test.skip(!probeConfigured, "Probe E2E requires API_URL and API_KEY in .env.");
  const probeModel = process.env.LLM_MODEL ?? "openai-gpt-4.1";

  await page.goto("/probe");
  await page.getByLabel("基础 URL").fill(probeUrl);
  await page.getByLabel("API 密钥").fill(probeKey);
  await page.getByLabel("目标模型").fill(probeModel);
  await page.getByRole("button", { name: "开始探测" }).click();

  await expect(page.getByText("探测结果")).toBeVisible();
  await expect(page.getByText(/探测通过|协议状态降级|协议检查失败|连通性失败/)).toBeVisible();
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
  await page.getByLabel("基础 URL").fill(probeUrl);
  await page.getByLabel("API 密钥").fill(probeKey);
  await page.getByLabel("目标模型").fill(probeModel);
  await page.locator("summary").filter({ hasText: "高级选项 / 接口类型" }).click();
  await page.getByLabel("兼容模式").selectOption(manualCompatibilityMode);
  await page.getByRole("button", { name: "开始探测" }).click();

  await expect(page.getByText("探测结果")).toBeVisible();
  await expect(page.getByText("探测通过")).toBeVisible();
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

test("public mobile navigation exposes the primary routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");
  await page.getByRole("button", { name: "打开菜单" }).click();
  const mobileNav = page.locator("#mobile-primary-nav");

  await expect(mobileNav.getByRole("link", { name: "首页" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "榜单" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "方法论" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "提交 Relay" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Relay 探测" })).toBeVisible();
});

test("homepage prioritizes quick probe on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHome(page);

  const quickProbeHeading = page.getByText("快速探测");
  const heroHeading = page.getByRole("heading", { name: /快速发现优质 relay/i });
  const quickProbeBox = await quickProbeHeading.boundingBox();
  const heroHeadingBox = await heroHeading.boundingBox();

  expect(quickProbeBox).not.toBeNull();
  expect(heroHeadingBox).not.toBeNull();
  expect(quickProbeBox!.y).toBeLessThan(heroHeadingBox!.y);
});

test("probe page stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");

  await expect(page.getByRole("heading", { name: "运行探测" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "探测结果" })).toBeVisible();
  await expect(page.locator(".input-helper-mobile")).toHaveCount(3);
  await expect(page.locator(".input-helper-desktop")).toHaveCount(3);
  await expect(page.locator(".input-helper-mobile").first()).toBeVisible();
  await expect(page.locator(".input-helper-desktop").first()).toBeHidden();
  await expect(page.getByText("Before you run")).toHaveCount(0);
  await expect(page.getByText("What the result includes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开始探测" })).toBeVisible();
});

test("leaderboard remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/leaderboard");

  await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("24h 可用性").first()).toBeVisible();
  await expect(page.getByText("P50 延迟").first()).toBeVisible();
  await expectVisibleText(page.locator("main"), /自然排名|方法论入口|赞助分离/);
  await expect(page.getByText("当前表格不含赞助位")).toBeVisible();
});
