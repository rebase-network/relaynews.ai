import { expect, test } from "@playwright/test";

test("admin overview shows operating totals", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.getByText("Operate the relay catalog, sponsorships, and pricing lanes.")).toBeVisible();
  await expect(page.getByText("pending submissions")).toBeVisible();
});

test("admin can create a relay", async ({ page }) => {
  const slug = `northwind-${Date.now()}`;
  const name = `Northwind ${Date.now()}`;

  await page.goto("http://127.0.0.1:4174/relays");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Base URL").fill(`https://${slug}.example.ai/v1`);
  await page.getByLabel("Provider").fill("Northwind Labs");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("Relay created.")).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
});

test("admin can review submissions, create sponsors, and add prices", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/submissions");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText(/Submission approved\./)).toBeVisible();

  await page.goto("http://127.0.0.1:4174/sponsors");
  await page.getByLabel("Name").fill(`Sponsor ${Date.now()}`);
  await page.getByLabel("Placement").fill("leaderboard-spotlight");
  await page.getByRole("button", { name: "Create placement" }).click();
  await expect(page.getByText("Sponsor placement created.")).toBeVisible();

  await page.goto("http://127.0.0.1:4174/prices");
  await page.getByLabel("Relay").selectOption({ index: 1 });
  await page.getByLabel("Model").selectOption({ index: 1 });
  await page.getByLabel("Input price").fill("0.33");
  await page.getByLabel("Output price").fill("1.22");
  await page.getByRole("button", { name: "Create price" }).click();
  await expect(page.getByText("Price record created.")).toBeVisible();
});
