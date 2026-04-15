import { expect, test, type Page } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const allowDeployedWrites = process.env.E2E_ALLOW_DEPLOYED_WRITES === "1";
const adminBaseUrl = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4174";
const apiBaseUrl =
  process.env.API_BASE_URL ?? (isDeployedRun ? "https://api.relaynew.ai" : "http://127.0.0.1:8787");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  await page.goto(`${adminBaseUrl}/`);
  return {
    relays: await readOverviewMetric(page, "relays"),
    pendingSubmissions: await readOverviewMetric(page, "pending submissions"),
    activeSponsors: await readOverviewMetric(page, "active sponsors"),
    priceRecords: await readOverviewMetric(page, "price records"),
  };
}

test("admin overview shows operating totals", async ({ page }) => {
  await page.goto(`${adminBaseUrl}/`);
  await expect(page.getByText("Operate the relay catalog, sponsorships, and pricing lanes.")).toBeVisible();
  await expect(page.getByText(/pending submissions/i)).toBeVisible();

  await page.getByRole("link", { name: "Relays" }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/relays$`));
  await expect(page.getByRole("heading", { name: "Relay catalog", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Submissions" }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/submissions$`));
  await expect(page.getByRole("heading", { name: "Submission queue", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Sponsors" }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sponsors$`));
  await expect(page.getByRole("heading", { name: "Sponsor placements", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Prices" }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/prices$`));
  await expect(page.getByRole("heading", { name: "Price history", exact: true })).toBeVisible();
});

test("admin relay form validates malformed URLs before saving", async ({ page }) => {
  await page.goto(`${adminBaseUrl}/relays`);
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

  await page.goto(`${adminBaseUrl}/relays`);
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

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: `https://${relaySlug}.example.ai/v1`,
      providerName: "Playwright Ops",
      websiteUrl: `https://${relaySlug}.example.ai`,
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created by deployed Playwright admin coverage.",
      docsUrl: `https://${relaySlug}.example.ai/docs`,
      notes: "Playwright admin verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();

  const submissionResponse = await request.post(`${apiBaseUrl}/public/submissions`, {
    data: {
      relayName,
      baseUrl: `https://${relaySlug}.example.ai/v1`,
      websiteUrl: "https://review.example.ai",
      submitterEmail: "ops@example.com",
      notes: "Created by deployed Playwright admin coverage.",
    },
  });
  expect(submissionResponse.ok()).toBeTruthy();

  const before = await readOverviewTotals(page);

  await page.goto(`${adminBaseUrl}/submissions`);
  const submissionCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(submissionCard).toBeVisible();
  await submissionCard.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Submission approved\./)).toBeVisible();
  await expect(submissionCard).toContainText(/approved/i);

  await page.goto(`${adminBaseUrl}/sponsors`);
  await page.getByLabel("Name").fill(sponsorName);
  await page.getByLabel("Placement").fill("leaderboard-spotlight");
  await page.getByLabel("Relay").selectOption({ label: relayName });
  await page.getByRole("button", { name: "Create placement" }).click();
  await expect(page.getByText("Sponsor placement created.")).toBeVisible();
  const sponsorCard = page.locator(".admin-list-card").filter({ hasText: sponsorName }).first();
  await expect(sponsorCard).toBeVisible();
  await expect(sponsorCard).toContainText(relayName);

  await page.goto(`${adminBaseUrl}/prices`);
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
