import { expect, test } from "@playwright/test";

test("public site renders the main discovery flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Watch relay health, latency, price pressure, and trust signals")).toBeVisible();
  await expect(page.getByText("Featured leaderboards")).toBeVisible();

  await page.getByRole("link", { name: "Open leaderboard" }).click();
  await expect(page).toHaveURL(/leaderboard\/openai-gpt-4\.1/);
  await expect(page.getByRole("heading", { name: "GPT-4.1" })).toBeVisible();

  await page.getByRole("link", { name: "Aurora Relay" }).first().click();
  await expect(page).toHaveURL(/relay\/aurora-relay/);
  await expect(page.getByRole("heading", { name: "Aurora Relay" })).toBeVisible();
  await expect(page.getByText("Score composition")).toBeVisible();
});

test("submit flow works from the public site", async ({ page }) => {
  const relayName = `Beacon Relay ${Date.now()}`;

  await page.goto("/submit");
  await page.getByLabel("Relay name").fill(relayName);
  await page.getByLabel("Base URL").fill(`https://beacon-${Date.now()}.example.ai/v1`);
  await page.getByLabel("Website URL").fill("https://beacon.example.ai");
  await page.getByLabel("Contact email").fill("ops@example.com");
  await page.getByRole("button", { name: "Submit relay" }).click();

  await expect(page.getByText("Submission created:")).toBeVisible();
});

test("public probe flow returns a diagnostic result", async ({ page }) => {
  const probeUrl = process.env.API_URL ?? "https://example.com";
  const probeKey = process.env.API_KEY ?? "sk-demo";
  const probeModel = process.env.LLM_MODEL ?? "openai-gpt-4.1";

  await page.goto("/probe");
  await page.getByLabel("Base URL").fill(probeUrl);
  await page.getByLabel("API key").fill(probeKey);
  await page.getByLabel("Model").fill(probeModel);
  await page.getByRole("button", { name: "Run probe" }).click();

  await expect(page.getByText("Probe result")).toBeVisible();
  await expect(page.getByText("Host")).toBeVisible();
});
