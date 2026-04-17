import { expect, test } from "@playwright/test";

const isDeployedRun = process.env.E2E_DEPLOYED === "1";
const allowDeployedWrites = process.env.E2E_ALLOW_DEPLOYED_WRITES === "1";
const apiBaseUrl =
  process.env.API_BASE_URL ?? (isDeployedRun ? "https://api.relaynew.ai" : "http://127.0.0.1:8787");

test("public GET endpoints return cache headers", async ({ request }) => {
  const response = await request.get(`${apiBaseUrl}/public/home-summary`);

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("public, max-age=15");
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
    "public, max-age=60, stale-while-revalidate=300, stale-if-error=600",
  );
});

test("public 404 responses do not return cache headers", async ({ request }) => {
  const response = await request.get(`${apiBaseUrl}/public/relay/not-a-real-relay/overview`);

  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toBeUndefined();
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
});

test("public write-style endpoints stay uncached", async ({ request }) => {
  const probeResponse = await request.post(`${apiBaseUrl}/public/probe/check`, {
    data: {},
  });

  expect(probeResponse.status()).toBe(400);
  expect(probeResponse.headers()["cache-control"]).toBeUndefined();
  expect(probeResponse.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
});

test("public submissions stay on the public boundary without cache headers", async ({ request }) => {
  test.skip(
    isDeployedRun && !allowDeployedWrites,
    "Submission creation is skipped on deployed runs unless E2E_ALLOW_DEPLOYED_WRITES=1.",
  );

  const response = await request.post(`${apiBaseUrl}/public/submissions`, {
    data: {
      relayName: `API Cache Check ${Date.now()}`,
      baseUrl: `https://example.com/api-cache-${Date.now()}`,
      websiteUrl: "https://example.com",
      description: "Verifies public submission cache headers stay disabled.",
      submitterEmail: "ops@example.com",
      testApiKey: "sk-cache-check",
      testModel: "gpt-5.4",
      compatibilityMode: "auto",
    },
  });

  expect(response.status()).toBe(201);
  expect(response.headers()["cache-control"]).toBeUndefined();
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBeUndefined();
});
