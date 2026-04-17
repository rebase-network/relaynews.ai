import { expect, test, type Page } from "@playwright/test";

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
  const heroHeading = page.getByRole("heading", { name: /Find strong relays fast/i });
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

test("public site renders the main discovery flow", async ({ page }) => {
  await gotoHome(page);
  await expect(page.getByRole("heading", { name: /Find strong relays fast/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Run probe" })).toBeVisible();
  await expect(page.getByText("Quick probe")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the pro probe page" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sponsors" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Watchlist" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Incidents" })).toHaveCount(0);

  if (isDeployedRun) {
    await page.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
    await expect(page.getByText("Ranked relay rows")).toBeVisible();

    await page.getByRole("link", { name: "Methodology" }).click();
    await expect(page).toHaveURL(/\/methodology$/);
    await expect(page.getByText("Methodology")).toBeVisible();

    await page.getByRole("link", { name: "Probe" }).click();
    await expect(page).toHaveURL(/\/probe$/);
    await expect(page.getByText("Self-check probe")).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: "Featured boards" })).toBeVisible();
  await page.getByRole("link", { name: "Browse leaderboards" }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
  await expect(page.getByText("Ranked relay rows")).toBeVisible();
  await page.getByRole("link", { name: "All model lanes" }).click();
  await expect(page).toHaveURL(/\/leaderboard\/directory$/);
  await expect(page.getByText("Leaderboard directory")).toBeVisible();
  await expect(page.getByLabel("Search lanes")).toHaveCount(0);
  await page.getByRole("button", { name: "Google" }).click();
  await expect(page.getByRole("heading", { name: "Gemini 3.1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sonnet 4.6" })).toHaveCount(0);

  await gotoHome(page);
  const featuredSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Featured boards" }) }).first();
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
  const gptBoardLink = gptBoardCard.getByRole("link", { name: "Open full board" });
  const gptBoardHref = await gptBoardLink.getAttribute("href");
  expect(gptBoardHref).not.toBeNull();
  const escapedBoardHref = gptBoardHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await gptBoardLink.click();
  await expect(page).toHaveURL(new RegExp(`${escapedBoardHref}$`));
  await expect(page.getByText("Ranked relay rows")).toBeVisible();
  await expect(page.getByRole("link", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("Search and filters")).toHaveCount(0);
  await expect(page.getByLabel("Search relays")).toHaveCount(0);

  await page.getByRole("link", { name: "Aurora Relay" }).first().click();
  await expect(page).toHaveURL(/relay\/aurora-relay/);
  await expect(page.getByRole("heading", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latency profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Models" })).toBeVisible();
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
  await expect(page.getByTestId("score-popover").getByText("Breakdown")).toBeVisible();
  await page.getByRole("heading", { name: "Aurora Relay" }).click();
  await expect(page.getByTestId("score-popover")).toHaveCount(0);
});

test("submit flow works from the public site", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Submission creation is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const relayName = `Beacon Relay ${Date.now()}`;
  const relayBaseUrl = `https://example.com/relay/${Date.now()}`;

  await page.goto("/submit");
  await page.getByLabel("Relay name").fill(relayName);
  await page.getByLabel("Base URL").fill(relayBaseUrl);
  await page.getByLabel("Website URL").fill("https://example.com");
  await page.getByLabel("Relay description").fill("Playwright submission coverage for a monitored relay.");
  await page.getByLabel("Contact email").fill("ops@example.com");
  await page.getByLabel("Test API key").fill("sk-submit-check");
  await page.getByLabel("Test model").fill("gpt-5.4");
  await page.getByRole("button", { name: "Submit relay" }).click();

  await expect(page.getByText("Submission created:")).toBeVisible();
  await expect(page.getByText(/^Initial probe:/)).toBeVisible();
});

test("submit flow validates malformed relay URLs before sending", async ({ page }) => {
  await page.goto("/submit");
  await page.getByLabel("Relay name").fill("Broken Relay");
  await page.getByLabel("Base URL").fill("relay.example.ai");
  await page.getByLabel("Website URL").fill("not-a-url");
  await page.getByLabel("Relay description").fill("");
  await page.getByLabel("Contact email").fill("ops@");
  await page.getByLabel("Test model").fill("");
  await page.getByRole("button", { name: "Submit relay" }).click();

  await expect(page.getByText("Please fix the highlighted fields before submitting.")).toBeVisible();
  await expect(page.getByText("Enter a full HTTPS base URL such as https://relay.example.ai/v1.")).toBeVisible();
  await expect(page.getByText("Enter a valid website URL such as https://relay.example.ai.")).toBeVisible();
  await expect(page.getByText("Add a short relay description so the review queue understands this endpoint.")).toBeVisible();
  await expect(page.getByText("Enter a valid contact email address.")).toBeVisible();
  await expect(page.getByText("A test key is required for the initial relay probe.")).toBeVisible();
  await expect(page.getByText("A test model is required.")).toBeVisible();
  await expect(page.getByText("Submission created:")).toHaveCount(0);
});

test("public probe flow returns a diagnostic result", async ({ page }) => {
  test.skip(!probeConfigured, "Probe E2E requires API_URL and API_KEY in .env.");
  const probeModel = process.env.LLM_MODEL ?? "openai-gpt-4.1";

  await page.goto("/probe");
  await page.getByLabel("Base URL").fill(probeUrl);
  await page.getByLabel("API key").fill(probeKey);
  await page.getByLabel("Model").fill(probeModel);
  await page.getByRole("button", { name: "Run probe" }).click();

  await expect(page.getByText("Probe result")).toBeVisible();
  await expect(page.getByText(/Probe healthy|Protocol degraded|Protocol failed|Connectivity failed/)).toBeVisible();
  await expect(page.getByTestId("probe-host-value")).toContainText(new URL(probeUrl).host);
  await expect(page.getByTestId("probe-connectivity-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-protocol-value")).toHaveText(/\S+/);
  await expect(page.getByTestId("probe-detection-value")).toHaveText("Automatic");
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
  await page.getByLabel("API key").fill(probeKey);
  await page.getByLabel("Model").fill(probeModel);
  await page.locator("summary").filter({ hasText: "Advanced" }).click();
  await page.getByLabel("Compatibility Mode").selectOption(manualCompatibilityMode);
  await page.getByRole("button", { name: "Run probe" }).click();

  await expect(page.getByText("Probe result")).toBeVisible();
  await expect(page.getByText("Probe healthy")).toBeVisible();
  await expect(page.getByTestId("probe-connectivity-value")).toHaveText("ok");
  await expect(page.getByTestId("probe-protocol-value")).toHaveText("healthy");
  await expect(page.getByTestId("probe-detection-value")).toHaveText("Manual override");
  await expect(page.getByTestId("probe-mode-value")).toHaveText(manualCompatibilityLabels[manualCompatibilityMode]);
  await expect(page.getByTestId("probe-model-value")).toHaveText(probeModel);
  await expect(page.getByTestId("probe-http-status-value")).toHaveText("200");
  await expect(page.getByText("Execution trace")).toBeVisible();
  await page.getByTestId("probe-copy-endpoint-button").click();
  await expect(page.getByTestId("probe-copy-endpoint-button")).toHaveText("Copied");
  await expect(page.getByText(/^Upstream returned /)).toHaveCount(0);
});

test("public mobile navigation exposes the primary routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");
  await page.getByRole("button", { name: "Menu" }).click();
  const mobileNav = page.locator("#mobile-primary-nav");

  await expect(mobileNav.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Leaderboard" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Methodology" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Submit" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Probe" })).toBeVisible();
});

test("homepage prioritizes quick probe on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHome(page);

  const quickProbeHeading = page.getByText("Quick probe");
  const heroHeading = page.getByRole("heading", { name: /Find strong relays fast/i });
  const quickProbeBox = await quickProbeHeading.boundingBox();
  const heroHeadingBox = await heroHeading.boundingBox();

  expect(quickProbeBox).not.toBeNull();
  expect(heroHeadingBox).not.toBeNull();
  expect(quickProbeBox!.y).toBeLessThan(heroHeadingBox!.y);
});

test("probe page stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/probe");

  await expect(page.getByRole("heading", { name: "Run probe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Probe result" })).toBeVisible();
  await expect(page.locator(".input-helper-mobile")).toHaveCount(3);
  await expect(page.locator(".input-helper-desktop")).toHaveCount(3);
  await expect(page.locator(".input-helper-mobile").first()).toBeVisible();
  await expect(page.locator(".input-helper-desktop").first()).toBeHidden();
  await expect(page.getByText("Before you run")).toHaveCount(0);
  await expect(page.getByText("What the result includes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run probe" })).toBeVisible();
});

test("leaderboard remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/leaderboard");

  await expect(page.getByRole("heading", { name: "GPT 5.4" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("Avail 24h").first()).toBeVisible();
  await expect(page.getByText("Latency p50").first()).toBeVisible();
});
