import test from "node:test";
import assert from "node:assert/strict";

import {
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
  assert.equal(response.compatibilityMode, "openai-responses");
  assert.equal(response.attemptedModes[0], "openai-responses");
  assert.equal(probeCompatibilityModeSchema.safeParse("auto").success, true);
  assert.equal(probeResolvedCompatibilityModeSchema.safeParse("auto").success, false);
});

test("methodology payload parses", () => {
  const parsed = methodologyResponseSchema.parse({
    weights: {
      availability: 35,
      latency: 20,
      consistency: 20,
      value: 15,
      stability: 10,
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

  assert.equal(parsed.weights.availability, 35);
});

test("public submission and admin relay inputs parse", () => {
  const submission = publicSubmissionRequestSchema.parse({
    relayName: "Northwind Relay",
    baseUrl: "https://northwind.example.ai/v1",
    websiteUrl: "https://northwind.example.ai",
    submitterEmail: "ops@example.com",
  });

  const relay = adminRelayUpsertSchema.parse({
    slug: "northwind-relay",
    name: "Northwind Relay",
    baseUrl: "https://northwind.example.ai/v1",
    catalogStatus: "active",
  });

  assert.equal(submission.relayName, "Northwind Relay");
  assert.equal(relay.slug, "northwind-relay");
});

test("public submission and admin relay inputs normalize blank optional fields", () => {
  const submission = publicSubmissionRequestSchema.parse({
    relayName: "Northwind Relay",
    baseUrl: " https://northwind.example.ai/v1 ",
    websiteUrl: "",
    submitterEmail: "",
    notes: "   ",
  });

  const relay = adminRelayUpsertSchema.parse({
    slug: "northwind-relay",
    name: "Northwind Relay",
    baseUrl: " https://northwind.example.ai/v1 ",
    providerName: "",
    websiteUrl: "",
    docsUrl: "",
    notes: "",
  });

  assert.equal(submission.baseUrl, "https://northwind.example.ai/v1");
  assert.equal(submission.websiteUrl, undefined);
  assert.equal(submission.submitterEmail, undefined);
  assert.equal(relay.baseUrl, "https://northwind.example.ai/v1");
  assert.equal(relay.providerName, null);
  assert.equal(relay.websiteUrl, null);
  assert.equal(relay.docsUrl, null);
  assert.equal(relay.notes, null);
});
