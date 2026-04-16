import { expect, test, type Page } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const allowDeployedWrites = process.env.E2E_ALLOW_DEPLOYED_WRITES === "1";
const adminBaseUrl = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4174";
const webBaseUrl = process.env.WEB_BASE_URL ?? "http://127.0.0.1:4173";
const apiBaseUrl =
  process.env.API_BASE_URL ?? (isDeployedRun ? "https://api.relaynew.ai" : "http://127.0.0.1:8787");
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_AUTH_USERNAME ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_AUTH_PASSWORD ?? "";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function openAdmin(page: Page, path = "/") {
  await page.goto(`${adminBaseUrl}${path}`);

  const loginHeading = page.getByRole("heading", { name: "Sign in to continue", exact: true });
  const adminBrand = page.getByText("relaynew.ai admin", { exact: true });

  await Promise.race([
    loginHeading.waitFor({ state: "visible" }).catch(() => undefined),
    adminBrand.waitFor({ state: "visible" }).catch(() => undefined),
  ]);

  if (!(await loginHeading.isVisible().catch(() => false))) {
    return;
  }

  expect(
    adminUsername && adminPassword,
    "Admin auth is enabled. Set ADMIN_AUTH_USERNAME and ADMIN_AUTH_PASSWORD in .env for Playwright.",
  ).toBeTruthy();

  await page.getByLabel("Username").fill(adminUsername);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(adminBrand).toBeVisible();
}

async function readOverviewMetric(page: Page, label: string) {
  const card = page.locator("section.card").filter({
    has: page.getByText(new RegExp(`^${escapeRegExp(label)}$`, "i")),
  }).first();
  await expect(card).toBeVisible();
  const value = await card.locator("h2").textContent();
  return Number(value);
}

async function readOverviewTotals(page: Page) {
  await openAdmin(page, "/");
  const pendingSubmissionsCard = page.locator("section.card").filter({
    has: page.getByText(/^pending submissions$/i),
  }).first();

  try {
    await pendingSubmissionsCard.waitFor({ state: "visible", timeout: 8_000 });
  } catch {
    const fetchError = page.getByText("Failed to fetch");
    if (await fetchError.isVisible().catch(() => false)) {
      await page.reload();
    }

    await pendingSubmissionsCard.waitFor({ state: "visible", timeout: 8_000 });
  }

  return {
    relays: await readOverviewMetric(page, "relays"),
    pendingSubmissions: await readOverviewMetric(page, "pending submissions"),
    activeSponsors: await readOverviewMetric(page, "active sponsors"),
    priceRecords: await readOverviewMetric(page, "price records"),
  };
}

test("admin overview shows operating totals", async ({ page }) => {
  await openAdmin(page, "/");
  await expect(page.getByText("Operate the relay catalog, sponsorships, and pricing lanes.")).toBeVisible();
  const overviewTotals = await readOverviewTotals(page);
  expect(overviewTotals.pendingSubmissions).toBeGreaterThanOrEqual(0);

  await page.getByRole("link", { name: "Relays", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/relays$`));
  await expect(page.getByRole("heading", { name: "Relay catalog", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Intake", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/intake$`));
  await expect(page.getByRole("heading", { name: "Intake queue", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Keys", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/credentials$`));
  await expect(page.getByRole("heading", { name: "Relay keys", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Sponsors", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sponsors$`));
  await expect(page.getByRole("heading", { name: "Sponsor placements", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Prices", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/prices$`));
  await expect(page.getByRole("heading", { name: "Price history", exact: true })).toBeVisible();
});

test("admin relay form validates malformed URLs before saving", async ({ page }) => {
  await openAdmin(page, "/relays");
  await page.getByLabel("Slug").fill("broken-relay");
  await page.getByLabel("Name").fill("Broken Relay");
  await page.getByLabel("Base URL").fill("relay.example.ai");
  await page.getByLabel("Website").fill("not-a-url");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("Please fix the highlighted relay fields before saving.")).toBeVisible();
  await expect(page.getByText("Enter a full base URL such as https://relay.example.ai/v1.")).toBeVisible();
  await expect(page.getByText("Enter a valid website URL such as https://relay.example.ai.")).toBeVisible();
  await expect(page.getByText("Relay created.")).toHaveCount(0);
});

test("admin can create a relay", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Relay creation is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const before = await readOverviewTotals(page);
  const slug = `northwind-${Date.now()}`;
  const name = `Northwind ${Date.now()}`;

  await openAdmin(page, "/relays");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Base URL").fill(`https://${slug}.example.ai/v1`);
  await page.getByLabel("Provider").fill("Northwind Labs");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("Relay created.")).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();

  const after = await readOverviewTotals(page);
  expect(after.relays).toBe(before.relays + 1);
});

test("admin can create and manage probe credentials", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Credential management is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const relaySlug = `credential-relay-${runId}`;
  const relayName = `Credential Relay ${runId}`;
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;

  await openAdmin(page, "/credentials");

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Credential Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created for credential admin coverage.",
      docsUrl: `https://example.com/docs/${relaySlug}`,
      notes: "Playwright credential verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(adminBaseUrl).origin,
  });

  await openAdmin(page, "/credentials");
  const createCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Attach key", exact: true }),
  }).first();
  await createCard.getByLabel("Owner record").selectOption({ label: relayName });
  await createCard.getByLabel("API key").fill("sk-credential-initial");
  await createCard.getByLabel("Test model").fill("gpt-5.4");
  await createCard.getByRole("button", { name: "Attach key" }).click();
  await expect(page.getByText(/Key attached\./)).toBeVisible();

  const credentialCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(credentialCard).toBeVisible();
  await credentialCard.click();
  const detailCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Key detail", exact: true }),
  }).first();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.getByText("sk-credential-initial")).toBeVisible();

  await page.getByRole("button", { name: "Copy key" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

  const reprobeResponse = page.waitForResponse((response) =>
    response.url().includes("/admin/probe-credentials/") &&
    response.url().includes("/reprobe") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Re-run probe" }).click();
  expect((await reprobeResponse).ok()).toBeTruthy();

  await page.getByLabel("New API key").fill("sk-credential-rotated");
  await page.getByRole("button", { name: "Rotate key" }).click();
  await expect(page.getByText(/Key rotated\./)).toBeVisible();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.getByText("sk-credential-rotated")).toBeVisible();

  await detailCard.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(page.getByText("Key revoked.")).toBeVisible();
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName }).first()).toContainText("revoked");
});

test("admin can review submissions, create sponsors, and add prices", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Write-path admin tests are skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const relayName = `Review Queue ${runId}`;
  const relaySlug = `review-queue-${runId}`;
  const sponsorName = `Sponsor ${Date.now()}`;
  const inputPrice = "0.33";
  const outputPrice = "1.22";
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;

  await openAdmin(page, "/intake");

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Playwright Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created by deployed Playwright admin coverage.",
      docsUrl: `https://example.com/docs/${relaySlug}`,
      notes: "Playwright admin verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();

  const submissionResponse = await request.post(`${apiBaseUrl}/public/submissions`, {
    data: {
      relayName,
      baseUrl: relayBaseUrl,
      websiteUrl: "https://example.com",
      submitterEmail: "ops@example.com",
      notes: "Created by deployed Playwright admin coverage.",
      testApiKey: "sk-playwright-submit",
      testModel: "gpt-5.4",
    },
  });
  expect(submissionResponse.ok()).toBeTruthy();

  const before = await readOverviewTotals(page);

  await openAdmin(page, "/intake");
  const submissionCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(submissionCard).toBeVisible();
  await expect(submissionCard).toContainText("Credential");
  await expect(submissionCard).toContainText("Probe");
  await expect(submissionCard).toContainText("gpt-5.4");
  await submissionCard.getByRole("button", { name: "Approve & activate" }).click();
  await expect(page.getByText(/Relay activated, credential moved, and monitoring started\./)).toBeVisible();
  await expect(submissionCard).toContainText(/approved/i);
  await expect(submissionCard).toContainText("Linked relay");

  await page.goto(`${webBaseUrl}/leaderboard/openai-gpt-5.4`);
  await expect(page.getByRole("link", { name: relayName })).toBeVisible();

  await openAdmin(page, "/relays");
  const relayCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(relayCard).toContainText(/Monitoring key · active/i);
  await relayCard.getByRole("link", { name: "Manage key" }).click();
  await expect(page).toHaveURL(/\/credentials\?/);
  await expect(page.getByRole("heading", { name: "Key detail", exact: true })).toBeVisible();
  await expect(page.getByText(relayName).first()).toBeVisible();

  await openAdmin(page, "/sponsors");
  await page.getByLabel("Name").fill(sponsorName);
  await page.getByLabel("Placement").fill("leaderboard-spotlight");
  await page.getByLabel("Relay").selectOption({ label: relayName });
  await page.getByRole("button", { name: "Create placement" }).click();
  await expect(page.getByText("Sponsor placement created.")).toBeVisible();
  const sponsorCard = page.locator(".admin-list-card").filter({ hasText: sponsorName }).first();
  await expect(sponsorCard).toBeVisible();
  await expect(sponsorCard).toContainText(relayName);

  await openAdmin(page, "/prices");
  await page.getByLabel("Relay").selectOption({ label: relayName });
  await page.getByLabel("Model").selectOption({ label: "GPT-4.1" });
  await page.getByLabel("Input price").fill(inputPrice);
  await page.getByLabel("Output price").fill(outputPrice);
  await page.getByRole("button", { name: "Create price" }).click();
  await expect(page.getByText("Price record created.")).toBeVisible();
  const priceCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(priceCard).toBeVisible();
  await expect(priceCard).toContainText("GPT-4.1");
  await expect(priceCard).toContainText(`${inputPrice} / ${outputPrice}`);

  const after = await readOverviewTotals(page);
  expect(after.pendingSubmissions).toBe(before.pendingSubmissions - 1);
  expect(after.activeSponsors).toBe(before.activeSponsors + 1);
  expect(after.priceRecords).toBe(before.priceRecords + 1);
});
