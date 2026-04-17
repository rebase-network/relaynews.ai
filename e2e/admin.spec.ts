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

  const loginHeading = page.getByRole("heading", { name: "登录后继续", exact: true });
  const adminBrand = page.getByText("relaynew.ai 管理台", { exact: true });

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

  await page.getByLabel("用户名").fill(adminUsername);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: "登录" }).click();
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
    has: page.getByText(/^待审核提交$/),
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
    relays: await readOverviewMetric(page, "中转站总数"),
    pendingSubmissions: await readOverviewMetric(page, "待审核提交"),
    activeSponsors: await readOverviewMetric(page, "投放中赞助位"),
    priceRecords: await readOverviewMetric(page, "价格记录"),
  };
}

async function openRelayForEditing(page: Page, relayName: string) {
  const relayCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(relayCard).toBeVisible();
  await relayCard.getByRole("button", { name: "编辑中转站" }).click();
  return relayCard;
}

async function openSponsorForEditing(page: Page, sponsorName: string) {
  const sponsorCard = page.locator(".admin-list-card").filter({ hasText: sponsorName }).first();
  await expect(sponsorCard).toBeVisible();
  await sponsorCard.getByRole("button", { name: "编辑赞助位" }).click();
  return sponsorCard;
}

async function openPriceForEditing(page: Page, relayName: string) {
  const priceCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(priceCard).toBeVisible();
  await priceCard.getByRole("button", { name: "编辑价格记录" }).click();
  return priceCard;
}

async function openModelForEditing(page: Page, modelName: string) {
  const modelCard = page.locator(".admin-list-card").filter({ hasText: modelName }).first();
  await expect(modelCard).toBeVisible();
  await modelCard.getByRole("button", { name: "编辑模型" }).click();
  return modelCard;
}

test("admin overview shows operating totals", async ({ page }) => {
  await openAdmin(page, "/");
  await expect(page.getByText("统一管理中转站目录、模型、赞助位与价格记录。", { exact: true })).toBeVisible();
  const overviewTotals = await readOverviewTotals(page);
  expect(overviewTotals.pendingSubmissions).toBeGreaterThanOrEqual(0);

  await page.getByRole("link", { name: "中转站", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/relays$`));
  await expect(page.getByRole("heading", { name: "中转站目录", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "审核队列", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/intake$`));
  await expect(page.getByRole("heading", { name: "审核队列", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "密钥", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/credentials$`));
  await expect(page.getByRole("heading", { name: "Relay 监测密钥", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "赞助位", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sponsors$`));
  await expect(page.getByRole("heading", { name: "赞助位列表", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "模型", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/models$`));
  await expect(page.getByRole("heading", { name: "模型列表", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "价格", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${adminBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/prices$`));
  await expect(page.getByRole("heading", { name: "价格历史", exact: true })).toBeVisible();
});

test("admin relay form validates malformed URLs before saving", async ({ page }) => {
  await openAdmin(page, "/relays");
  await page.getByLabel("标识 Slug").fill("broken-relay");
  await page.getByLabel("名称").fill("Broken Relay");
  await page.getByLabel("基础 URL").fill("relay.example.ai");
  await page.getByLabel("官网地址").fill("not-a-url");
  await page.getByRole("button", { name: "创建" }).click();

  await expect(page.getByText("请先修正高亮字段，再保存中转站。", { exact: true })).toBeVisible();
  await expect(page.getByText("请输入完整的基础 URL，例如 https://relay.example.ai/v1。", { exact: true })).toBeVisible();
  await expect(page.getByText("请输入有效的网站 URL，例如 https://relay.example.ai。", { exact: true })).toBeVisible();
  await expect(page.getByText("中转站已创建。")).toHaveCount(0);
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
  await page.getByLabel("标识 Slug").fill(slug);
  await page.getByLabel("名称").fill(name);
  await page.getByLabel("基础 URL").fill(`https://${slug}.example.ai/v1`);
  await page.getByLabel("提供方").fill("Northwind Labs");
  await page.getByRole("button", { name: "创建" }).click();

  await expect(page.getByText("中转站已创建。", { exact: true })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();

  const after = await readOverviewTotals(page);
  expect(after.relays).toBe(before.relays + 1);
});

test("admin can edit relay description, docs URL, and notes and keep them after reload", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Relay editing is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const relaySlug = `relay-metadata-${runId}`;
  const relayName = `Relay Metadata ${runId}`;
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;
  const description = "这是用于后台编辑能力覆盖的站点介绍。";
  const docsUrl = `https://example.com/docs/${relaySlug}`;
  const notes = "后台备注：用于验证刷新后仍能看到已保存内容。";

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Relay Metadata Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: null,
      docsUrl: null,
      notes: null,
    },
  });
  expect(relayResponse.ok()).toBeTruthy();

  await openAdmin(page, "/relays");
  await openRelayForEditing(page, relayName);

  await page.getByLabel(/(中转站介绍|站点介绍|description)/i).fill(description);
  await page.getByLabel(/(文档地址|文档 URL|docsUrl)/i).fill(docsUrl);
  await page.getByLabel(/(内部备注|备注|notes)/i).fill(notes);
  await page.getByRole("button", { name: "更新" }).click();

  await expect(page.getByText("中转站已更新。", { exact: true })).toBeVisible();

  await page.reload();
  await openRelayForEditing(page, relayName);

  await expect(page.getByLabel(/(中转站介绍|站点介绍|description)/i)).toHaveValue(description);
  await expect(page.getByLabel(/(文档地址|文档 URL|docsUrl)/i)).toHaveValue(docsUrl);
  await expect(page.getByLabel(/(内部备注|备注|notes)/i)).toHaveValue(notes);
});

test("admin can edit sponsors and unbind relay after reload", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Sponsor editing is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const relaySlug = `sponsor-relay-${runId}`;
  const relayName = `Sponsor Relay ${runId}`;
  const sponsorName = `Sponsor Edit ${runId}`;
  const updatedSponsorName = `Sponsor Edited ${runId}`;
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;
  const initialStartAt = "2026-04-01T00:00:00.000Z";
  const initialEndAt = "2026-05-01T00:00:00.000Z";
  const updatedStartAt = "2026-06-01T00:00:00.000Z";
  const updatedEndAt = "2026-07-01T00:00:00.000Z";

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Sponsor Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created for sponsor edit coverage.",
      docsUrl: `https://example.com/docs/${relaySlug}`,
      notes: "Playwright sponsor editing verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();
  const relayPayload = (await relayResponse.json()) as { id: string };

  const sponsorResponse = await request.post(`${apiBaseUrl}/admin/sponsors`, {
    headers: getAdminApiHeaders(),
    data: {
      relayId: relayPayload.id,
      name: sponsorName,
      placement: "homepage-spotlight",
      status: "active",
      startAt: initialStartAt,
      endAt: initialEndAt,
    },
  });
  expect(sponsorResponse.ok()).toBeTruthy();

  await openAdmin(page, "/sponsors");
  await openSponsorForEditing(page, sponsorName);

  await expect(page.getByLabel("名称")).toHaveValue(sponsorName);
  await expect(page.getByLabel("投放位标识")).toHaveValue("homepage-spotlight");
  await expect(page.getByLabel("关联中转站")).not.toHaveValue("");

  await page.getByLabel("名称").fill(updatedSponsorName);
  await page.getByLabel("投放位标识").fill("leaderboard-spotlight");
  await page.getByLabel("关联中转站").selectOption("");
  await page.getByLabel("状态").selectOption("paused");
  await page.getByLabel("开始时间").fill(updatedStartAt);
  await page.getByLabel("结束时间").fill(updatedEndAt);
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByText("赞助位已更新。", { exact: true })).toBeVisible();
  const updatedCard = page.locator(".admin-list-card").filter({ hasText: updatedSponsorName }).first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard).toContainText("leaderboard-spotlight");
  await expect(updatedCard).toContainText("已暂停");
  await expect(updatedCard).toContainText("未绑定中转站");

  await page.reload();
  await openSponsorForEditing(page, updatedSponsorName);

  await expect(page.getByLabel("名称")).toHaveValue(updatedSponsorName);
  await expect(page.getByLabel("投放位标识")).toHaveValue("leaderboard-spotlight");
  await expect(page.getByLabel("关联中转站")).toHaveValue("");
  await expect(page.getByLabel("状态")).toHaveValue("paused");
  await expect(page.getByLabel("开始时间")).toHaveValue(updatedStartAt);
  await expect(page.getByLabel("结束时间")).toHaveValue(updatedEndAt);

  const updatedSponsorCard = page.locator(".admin-list-card").filter({ hasText: updatedSponsorName }).first();
  await updatedSponsorCard.getByRole("button", { name: "删除赞助位" }).click();
  const deleteSponsorDialog = page.getByRole("dialog");
  await expect(deleteSponsorDialog).toBeVisible();
  await deleteSponsorDialog.getByRole("button", { name: "删除赞助位" }).click();
  await expect(page.getByText("赞助位已删除。", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-list-card").filter({ hasText: updatedSponsorName })).toHaveCount(0);
});

test("admin can edit and delete price records after reload", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Price editing is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const relaySlug = `price-relay-${runId}`;
  const relayName = `Price Relay ${runId}`;
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;
  const initialInputPrice = 0.11;
  const initialOutputPrice = 0.88;
  const updatedInputPrice = "0.55";
  const updatedOutputPrice = "1.66";
  const initialEffectiveFrom = "2026-03-01T00:00:00.000Z";
  const updatedEffectiveFrom = "2026-08-01T00:00:00.000Z";

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Price Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created for price editing coverage.",
      docsUrl: `https://example.com/docs/${relaySlug}`,
      notes: "Playwright price editing verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();
  const relayPayload = (await relayResponse.json()) as { id: string };

  const modelsResponse = await request.get(`${apiBaseUrl}/admin/models`, {
    headers: getAdminApiHeaders(),
  });
  expect(modelsResponse.ok()).toBeTruthy();
  const modelsPayload = (await modelsResponse.json()) as {
    rows: Array<{ id: string; name: string; key: string }>;
  };
  const model = modelsPayload.rows.find((row) => row.name === "GPT-4.1") ?? modelsPayload.rows[0];
  expect(model).toBeTruthy();

  const priceResponse = await request.post(`${apiBaseUrl}/admin/prices`, {
    headers: getAdminApiHeaders(),
    data: {
      relayId: relayPayload.id,
      modelId: model.id,
      currency: "USD",
      inputPricePer1M: initialInputPrice,
      outputPricePer1M: initialOutputPrice,
      effectiveFrom: initialEffectiveFrom,
      source: "manual",
    },
  });
  expect(priceResponse.ok()).toBeTruthy();

  await openAdmin(page, "/prices");
  await openPriceForEditing(page, relayName);

  await expect(page.getByLabel("中转站")).not.toHaveValue("");
  await expect(page.getByLabel("模型")).not.toHaveValue("");
  await expect(page.getByLabel("货币")).toHaveValue("USD");
  await expect(page.getByLabel("来源")).toHaveValue("manual");

  await page.getByLabel("输入价").fill(updatedInputPrice);
  await page.getByLabel("输出价").fill(updatedOutputPrice);
  await page.getByLabel("来源").selectOption("api");
  await page.getByLabel("生效时间").fill(updatedEffectiveFrom);
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByText("价格记录已更新。", { exact: true })).toBeVisible();
  const updatedCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard).toContainText(model.name);
  await expect(updatedCard).toContainText(`${updatedInputPrice} / ${updatedOutputPrice}`);
  await expect(updatedCard).toContainText("api");

  await page.reload();
  await openPriceForEditing(page, relayName);

  await expect(page.getByLabel("输入价")).toHaveValue(updatedInputPrice);
  await expect(page.getByLabel("输出价")).toHaveValue(updatedOutputPrice);
  await expect(page.getByLabel("来源")).toHaveValue("api");
  await expect(page.getByLabel("生效时间")).toHaveValue(updatedEffectiveFrom);

  const updatedPriceCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await updatedPriceCard.getByRole("button", { name: "删除价格记录" }).click();
  const deletePriceDialog = page.getByRole("dialog");
  await expect(deletePriceDialog).toBeVisible();
  await deletePriceDialog.getByRole("button", { name: "删除价格记录" }).click();
  await expect(page.getByText("价格记录已删除。", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(0);
});

test("admin can create and enable models for price entry", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Model management is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const runId = Date.now();
  const modelKey = `custom-model-${runId}`;
  const modelName = `模型 ${runId}`;
  const updatedModelName = `模型已启用 ${runId}`;

  await openAdmin(page, "/models");
  await page.getByLabel("模型键值").fill(modelKey);
  await page.getByLabel("模型名称").fill(modelName);
  await page.getByLabel("模型提供方").fill("Community Relay");
  await page.getByLabel("模型分类").fill("community-model");
  await page.getByLabel("输入价格单位").fill("USD / 1M tokens");
  await page.getByLabel("输出价格单位").fill("USD / 1M tokens");
  await expect(page.getByLabel("在价格录入中启用")).toBeChecked();
  await page.getByLabel("在价格录入中启用").uncheck();
  await page.getByRole("button", { name: "创建模型" }).click();

  await expect(page.getByText("模型已创建。", { exact: true })).toBeVisible();
  const createdCard = page.locator(".admin-list-card").filter({ hasText: modelName }).first();
  await expect(createdCard).toBeVisible();
  await expect(createdCard).toContainText(modelKey);
  await expect(createdCard).toContainText("已停用");

  await openAdmin(page, "/prices");
  await expect(page.getByLabel("模型").locator("option").filter({ hasText: modelName })).toHaveCount(0);

  await openAdmin(page, "/models");
  await openModelForEditing(page, modelName);
  await page.getByLabel("模型名称").fill(updatedModelName);
  await page.getByLabel("模型分类").fill("community-series");
  await page.getByLabel("在价格录入中启用").check();
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByText("模型已更新。", { exact: true })).toBeVisible();
  const updatedCard = page.locator(".admin-list-card").filter({ hasText: updatedModelName }).first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard).toContainText("community-series");
  await expect(updatedCard).toContainText("启用中");

  await page.reload();
  await openModelForEditing(page, updatedModelName);
  await expect(page.getByLabel("模型键值")).toHaveValue(modelKey);
  await expect(page.getByLabel("模型名称")).toHaveValue(updatedModelName);
  await expect(page.getByLabel("模型分类")).toHaveValue("community-series");
  await expect(page.getByLabel("在价格录入中启用")).toBeChecked();

  await openAdmin(page, "/prices");
  await expect(page.getByLabel("模型").locator("option").filter({ hasText: updatedModelName })).toHaveCount(1);
});

test("admin can soft delete a relay without removing its row", async ({ page, request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Relay soft delete is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );
  const before = await readOverviewTotals(page);
  const relaySlug = `soft-delete-${Date.now()}`;
  const relayName = `Soft Delete ${Date.now()}`;
  const relayBaseUrl = `https://example.com/relay/${relaySlug}`;

  const relayResponse = await request.post(`${apiBaseUrl}/admin/relays`, {
    headers: getAdminApiHeaders(),
    data: {
      slug: relaySlug,
      name: relayName,
      baseUrl: relayBaseUrl,
      providerName: "Soft Delete Ops",
      websiteUrl: "https://example.com",
      catalogStatus: "active",
      isFeatured: false,
      isSponsored: false,
      description: "Created to verify relay soft deletion.",
      docsUrl: `https://example.com/docs/${relaySlug}`,
      notes: "Playwright relay soft delete verification",
    },
  });
  expect(relayResponse.ok()).toBeTruthy();

  await openAdmin(page, "/relays");
  const relayCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(relayCard).toBeVisible();
  await relayCard.getByRole("button", { name: "归档" }).click();
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByRole("heading", { name: `确认归档 ${relayName}？` })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => document.querySelector(".confirm-backdrop")?.parentElement === document.body),
    )
    .toBe(true);
  await confirmDialog.getByRole("button", { name: "归档中转站" }).click();
  await expect(page.getByText("中转站已归档。它会从运营视图中隐藏，但仍保留在 Postgres 中。", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(0);

  const publicOverviewResponse = await request.get(`${apiBaseUrl}/public/relay/${relaySlug}/overview`);
  expect(publicOverviewResponse.status()).toBe(404);

  await openAdmin(page, "/credentials");
  const keyCreateCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "绑定监测密钥", exact: true }),
  }).first();
  const relaySelect = keyCreateCard.getByLabel("中转站");
  await expect(relaySelect.locator("option").filter({ hasText: relayName })).toHaveCount(0);

  await openAdmin(page, "/sponsors");
  await expect(page.getByLabel("关联中转站").locator("option").filter({ hasText: relayName })).toHaveCount(0);

  await openAdmin(page, "/prices");
  await expect(page.getByLabel("中转站").locator("option").filter({ hasText: relayName })).toHaveCount(0);

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
    has: page.getByRole("heading", { name: "绑定监测密钥", exact: true }),
  }).first();
  await expect(createCard.getByLabel("中转站")).toBeVisible();
  await expect(createCard.getByLabel("API Key")).toBeVisible();
  await expect(createCard.getByLabel("测试模型")).toBeVisible();
  await createCard.getByLabel("中转站").selectOption({ label: relayName });
  await createCard.getByLabel("API Key").fill("sk-credential-initial");
  await createCard.getByLabel("测试模型").fill("gpt-5.4");
  await createCard.getByRole("button", { name: "绑定监测密钥" }).click();
  await expect(page.getByText(/监测密钥已绑定。/)).toBeVisible();

  const credentialCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(credentialCard).toBeVisible();
  await credentialCard.click();
  const detailCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "监测密钥详情", exact: true }),
  }).first();
  await page.getByRole("button", { name: "显示密钥" }).click();
  await expect(page.getByText("sk-credential-initial")).toBeVisible();

  await page.getByRole("button", { name: "复制密钥" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();

  const reprobeResponse = page.waitForResponse((response) =>
    response.url().includes("/admin/probe-credentials/") &&
    response.url().includes("/reprobe") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "重新运行 Probe" }).click();
  expect((await reprobeResponse).ok()).toBeTruthy();

  await page.getByLabel("新的 API Key").fill("sk-credential-rotated");
  await page.getByRole("button", { name: "轮换密钥" }).click();
  await expect(page.getByText(/监测密钥已轮换。/)).toBeVisible();
  await page.getByRole("button", { name: "显示密钥" }).click();
  await expect(page.getByText("sk-credential-rotated")).toBeVisible();
  await detailCard.getByRole("button", { name: "撤销密钥", exact: true }).click();
  const revokeKeyDialog = page.getByRole("dialog");
  await expect(revokeKeyDialog).toBeVisible();
  await revokeKeyDialog.getByRole("button", { name: "撤销密钥" }).click();
  await expect(page.getByText("监测密钥已撤销。", { exact: true })).toBeVisible();
  await expect(detailCard).toContainText("已撤销");

  await page.getByLabel("搜索监测密钥").fill(relayName);
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(2);
  await page.getByLabel("状态筛选").selectOption("revoked");
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(1);
  await page.getByLabel("搜索监测密钥").fill("not-found");
  await expect(page.getByText("没有符合筛选条件的监测密钥。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清空筛选" }).click();
  await expect(page.locator(".admin-list-card").filter({ hasText: relayName })).toHaveCount(2);

  await detailCard.getByRole("button", { name: "删除密钥", exact: true }).click();
  const deleteKeyDialog = page.getByRole("dialog");
  await expect(deleteKeyDialog).toBeVisible();
  await deleteKeyDialog.getByRole("button", { name: "删除密钥" }).click();
  await expect(page.getByText("监测密钥已删除。", { exact: true })).toBeVisible();
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
  const submissionDescription = "Playwright intake description for review queue coverage.";

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
      description: submissionDescription,
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
  await expect(submissionCard).toContainText("关联密钥");
  await expect(submissionCard).toContainText("Probe");
  await expect(submissionCard).toContainText("gpt-5.4");
  await expect(submissionCard).toContainText(submissionDescription);
  await submissionCard.getByRole("button", { name: "批准并启用" }).click();
  await expect(page.getByText(/提交已通过，Relay 已启用，密钥已迁移，并已启动监测。/)).toBeVisible();
  const approvedCard = page.locator(".admin-list-card").filter({
    has: page.getByText(relayName, { exact: true }),
    hasNot: page.getByRole("button", { name: "批准并启用" }),
  }).first();
  await expect(approvedCard).toContainText("已通过");
  await expect(approvedCard).toContainText("已关联中转站");

  const refreshResponse = await request.post(`${apiBaseUrl}/admin/refresh-public`, {
    headers: getAdminApiHeaders(),
  });
  expect(refreshResponse.ok()).toBeTruthy();

  await expect
    .poll(async () => {
      const response = await request.get(`${apiBaseUrl}/public/relay/${relaySlug}/overview`);
      return response.ok();
    }, {
      timeout: 30_000,
    })
    .toBe(true);

  await page.goto(`${webBaseUrl}/relay/${relaySlug}`);
  await expect(page.getByRole("heading", { name: relayName, exact: true })).toBeVisible();

  await openAdmin(page, "/relays");
  const relayCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(relayCard).toContainText(/监测密钥 · 生效中/i);
  await relayCard.getByRole("link", { name: "管理密钥" }).click();
  await expect(page).toHaveURL(/\/credentials\?/);
  await expect(page.getByRole("heading", { name: "监测密钥详情", exact: true })).toBeVisible();
  await expect(page.getByText(relayName).first()).toBeVisible();

  await openAdmin(page, "/sponsors");
  await page.getByLabel("名称").fill(sponsorName);
  await page.getByLabel("投放位标识").fill("leaderboard-spotlight");
  await page.getByLabel("关联中转站").selectOption({ label: relayName });
  await page.getByRole("button", { name: "创建赞助位" }).click();
  await expect(page.getByText("赞助位已创建。", { exact: true })).toBeVisible();
  const sponsorCard = page.locator(".admin-list-card").filter({ hasText: sponsorName }).first();
  await expect(sponsorCard).toBeVisible();
  await expect(sponsorCard).toContainText(relayName);

  await openAdmin(page, "/prices");
  await page.getByLabel("中转站").selectOption({ label: relayName });
  await page.getByLabel("模型").selectOption({ label: "GPT-4.1" });
  await page.getByLabel("输入价").fill(inputPrice);
  await page.getByLabel("输出价").fill(outputPrice);
  await page.getByRole("button", { name: "创建价格记录" }).click();
  await expect(page.getByText("价格记录已创建。", { exact: true })).toBeVisible();
  const priceCard = page.locator(".admin-list-card").filter({ hasText: relayName }).first();
  await expect(priceCard).toBeVisible();
  await expect(priceCard).toContainText("GPT-4.1");
  await expect(priceCard).toContainText(`${inputPrice} / ${outputPrice}`);

  const after = await readOverviewTotals(page);
  expect(after.pendingSubmissions).toBe(before.pendingSubmissions - 1);
  expect(after.activeSponsors).toBe(before.activeSponsors + 1);
  expect(after.priceRecords).toBe(before.priceRecords + 1);
});

test("admin overview can trigger a manual public snapshot refresh", async ({ page }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Manual public snapshot refresh is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );

  await openAdmin(page, "/");
  const refreshButton = page.getByRole("button", { name: /手动刷新.*公开快照/i });
  await expect(refreshButton).toBeVisible();

  const refreshResponse = page.waitForResponse((response) =>
    response.url().includes("/admin/refresh-public") && response.request().method() === "POST",
  );
  await refreshButton.click();
  expect((await refreshResponse).ok()).toBeTruthy();

  await expect(page.getByText(/公开快照已刷新/i)).toBeVisible();
});
