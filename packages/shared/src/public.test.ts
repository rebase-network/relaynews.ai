import test from "node:test";
import assert from "node:assert/strict";

import {
  adminProbeCredentialCreateSchema,
  adminProbeCredentialDetailSchema,
  adminRelayUpsertSchema,
  homeSummaryResponseSchema,
  leaderboardDirectoryResponseSchema,
  leaderboardQuerySchema,
  methodologyResponseSchema,
  probeCompatibilityModeSchema,
  probeResolvedCompatibilityModeSchema,
  publicProbeRequestSchema,
  publicProbeResponseSchema,
  publicSubmissionRequestSchema,
  relayHistoryQuerySchema,
} from "./index";

test("home summary example parses", () => {
  const parsed = homeSummaryResponseSchema.parse({
    hero: {
      totalRelays: 42,
      healthyRelays: 38,
      degradedRelays: 3,
      downRelays: 1,
      measuredAt: "2026-04-15T10:00:00.000Z",
    },
    leaderboards: [
      {
        modelKey: "openai-gpt-4.1",
        modelName: "GPT-4.1",
        measuredAt: "2026-04-15T10:00:00.000Z",
        rows: [
          {
            rank: 1,
            relay: {
              slug: "sample-relay",
              name: "Sample Relay",
            },
            score: 96.2,
            availability24h: 0.998,
            latencyP50Ms: 820,
            latencyP95Ms: 1540,
            healthStatus: "healthy",
            badges: ["low-latency"],
          },
        ],
      },
    ],
    highlights: [
      {
        slug: "sample-relay",
        name: "Sample Relay",
        healthStatus: "healthy",
        badge: "high-stability",
      },
    ],
    latestIncidents: [],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(parsed.hero.totalRelays, 42);
});

test("leaderboard directory example parses", () => {
  const parsed = leaderboardDirectoryResponseSchema.parse({
    boards: [
      {
        modelKey: "openai-gpt-5.4",
        modelName: "GPT 5.4",
        measuredAt: "2026-04-15T10:00:00.000Z",
        rows: [
          {
            rank: 1,
            relay: {
              slug: "sample-relay",
              name: "Sample Relay",
            },
            score: 95.4,
            availability24h: 0.997,
            latencyP50Ms: 760,
            latencyP95Ms: 1410,
            healthStatus: "healthy",
            badges: ["high-stability"],
          },
        ],
      },
    ],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(parsed.boards[0]?.modelName, "GPT 5.4");
});

test("query defaults are applied", () => {
  const leaderboardQuery = leaderboardQuerySchema.parse({});
  const relayHistoryQuery = relayHistoryQuerySchema.parse({ window: "7d" });

  assert.equal(leaderboardQuery.region, "global");
  assert.equal(leaderboardQuery.limit, 20);
  assert.equal(relayHistoryQuery.region, "global");
});

test("probe request requires https", () => {
  const success = publicProbeRequestSchema.safeParse({
    baseUrl: "https://relay.example.ai/v1",
    apiKey: "sk-live",
    model: "openai-gpt-4.1",
  });

  const failure = publicProbeRequestSchema.safeParse({
    baseUrl: "http://relay.example.ai/v1",
    apiKey: "sk-live",
    model: "openai-gpt-4.1",
  });

  assert.equal(success.success, true);
  assert.equal(failure.success, false);
});

test("probe compatibility defaults and response diagnostics parse", () => {
  const request = publicProbeRequestSchema.parse({
    baseUrl: "https://relay.example.ai/v1",
    apiKey: "sk-live",
    model: "gpt-5.1",
  });

  const response = publicProbeResponseSchema.parse({
    ok: true,
    targetHost: "relay.example.ai",
    model: "gpt-5.1",
    connectivity: {
      ok: true,
      latencyMs: 320,
      ttfbMs: 320,
      firstTokenMs: 540,
    },
    protocol: {
      ok: true,
      healthStatus: "healthy",
      httpStatus: 200,
    },
    compatibilityMode: "openai-responses",
    detectionMode: "auto",
    usedUrl: "https://relay.example.ai/v1/responses",
    attemptedModes: ["openai-responses"],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(request.compatibilityMode, "auto");
  assert.equal(request.scanMode, "standard");
  assert.equal(response.scanMode, "standard");
  assert.equal(response.compatibilityMode, "openai-responses");
  assert.equal(response.attemptedModes[0], "openai-responses");
  assert.equal(response.matchedModes.length, 0);
  assert.equal(response.connectivity.ttfbMs, 320);
  assert.equal(response.connectivity.firstTokenMs, 540);
  assert.equal(probeCompatibilityModeSchema.safeParse("auto").success, true);
  assert.equal(probeCompatibilityModeSchema.safeParse("google-gemini-generate-content").success, true);
  assert.equal(probeResolvedCompatibilityModeSchema.safeParse("auto").success, false);
  assert.equal(probeResolvedCompatibilityModeSchema.safeParse("google-gemini-generate-content").success, true);
});

test("methodology payload parses", () => {
  const parsed = methodologyResponseSchema.parse({
    weights: {
      availability: 30,
      latency: 20,
      consistency: 15,
      value: 15,
      stability: 10,
      credibility: 10,
    },
    healthStatuses: ["healthy", "degraded", "down", "paused", "unknown"],
    badges: [
      "low-latency",
      "high-stability",
      "high-value",
      "sample-size-low",
      "under-observation",
    ],
    notes: [
      "Natural ranking and sponsor placement are separate.",
      "Sample size influences confidence and badge display.",
    ],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(parsed.weights.availability, 30);
});

test("public submission and admin relay inputs parse", () => {
  const submission = publicSubmissionRequestSchema.parse({
    relayName: "Northwind Relay",
    baseUrl: "https://northwind.example.ai/v1",
    websiteUrl: "https://northwind.example.ai",
    contactInfo: "Telegram: @northwind_ops",
    description: "Stable relay focused on low-latency OpenAI-compatible traffic.",
    modelPrices: [
      {
        modelKey: "gpt-5.4",
        inputPricePer1M: 4.6,
        outputPricePer1M: 13.2,
      },
    ],
    testApiKey: "sk-monitoring",
  });

  const relay = adminRelayUpsertSchema.parse({
    name: "Northwind Relay",
    baseUrl: "https://northwind.example.ai/v1",
    contactInfo: "Telegram: @northwind_ops",
    catalogStatus: "active",
    testApiKey: "sk-monitoring",
    modelPrices: [
      {
        modelKey: "openai-gpt-5.4",
        inputPricePer1M: 4.6,
        outputPricePer1M: 13.2,
      },
    ],
  });

  assert.equal(submission.relayName, "Northwind Relay");
  assert.equal(submission.contactInfo, "Telegram: @northwind_ops");
  assert.equal(submission.compatibilityMode, "auto");
  assert.equal(relay.testApiKey, "sk-monitoring");
});

test("public submission and admin relay inputs normalize blank optional fields", () => {
  const submission = publicSubmissionRequestSchema.parse({
    relayName: "Northwind Relay",
    baseUrl: " https://northwind.example.ai/v1 ",
    websiteUrl: "",
    contactInfo: "  微信：northwind-ops  ",
    description: "  Stable relay focused on low-latency OpenAI-compatible traffic.  ",
    notes: "   ",
    modelPrices: [
      {
        modelKey: " gpt-5.4 ",
        inputPricePer1M: " 4.6 ",
        outputPricePer1M: " 13.2 ",
      },
    ],
    testApiKey: " sk-monitoring ",
  });

  const relay = adminRelayUpsertSchema.parse({
    name: "Northwind Relay",
    baseUrl: " https://northwind.example.ai/v1 ",
    slug: "",
    websiteUrl: "",
    contactInfo: " ",
    testApiKey: "",
    modelPrices: [
      {
        modelKey: " openai-gpt-5.4 ",
        inputPricePer1M: " 4.6 ",
        outputPricePer1M: " 13.2 ",
      },
    ],
  });

  assert.equal(submission.baseUrl, "https://northwind.example.ai/v1");
  assert.equal(submission.websiteUrl, undefined);
  assert.equal(submission.contactInfo, "微信：northwind-ops");
  assert.equal(submission.description, "Stable relay focused on low-latency OpenAI-compatible traffic.");
  assert.equal(submission.testApiKey, "sk-monitoring");
  assert.equal(submission.testModel, undefined);
  assert.equal(submission.modelPrices[0]?.modelKey, "gpt-5.4");
  assert.equal(submission.modelPrices[0]?.inputPricePer1M, 4.6);
  assert.equal(relay.baseUrl, "https://northwind.example.ai/v1");
  assert.equal(relay.slug, undefined);
  assert.equal(relay.websiteUrl, null);
  assert.equal(relay.contactInfo, null);
  assert.equal(relay.testApiKey, null);
  assert.equal(relay.modelPrices[0]?.modelKey, "openai-gpt-5.4");
});

test("admin probe credential schemas parse", () => {
  const createPayload = adminProbeCredentialCreateSchema.parse({
    ownerType: "relay",
    ownerId: "relay-123",
    apiKey: " sk-monitoring ",
    testModel: " gpt-5.4 ",
  });

  const detailPayload = adminProbeCredentialDetailSchema.parse({
    id: "credential-123",
    ownerType: "relay",
    ownerId: "relay-123",
    ownerName: "Northwind Relay",
    ownerSlug: "northwind-relay",
    ownerBaseUrl: "https://northwind.example.ai/v1",
    status: "active",
    testModel: "gpt-5.4",
    compatibilityMode: "auto",
    apiKeyPreview: "sk-m…ring",
    apiKey: "sk-monitoring",
    lastVerifiedAt: "2026-04-15T10:00:00.000Z",
    lastProbeOk: false,
    lastHealthStatus: "degraded",
    lastHttpStatus: 405,
    lastMessage: "测试 OpenAI Responses 时，上游返回了 HTTP 405",
    lastDetectionMode: "auto",
    lastUsedUrl: "https://northwind.example.ai/v1/responses",
    createdAt: "2026-04-15T09:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(createPayload.apiKey, "sk-monitoring");
  assert.equal(createPayload.testModel, "gpt-5.4");
  assert.equal(detailPayload.ownerSlug, "northwind-relay");
  assert.equal(detailPayload.lastDetectionMode, "auto");
});
